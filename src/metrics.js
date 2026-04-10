const config = require("./config");
const os = require("os");

class Metrics {
	constructor() {
		this.httpCounts = new Map();
		this.authCounts = { success: 0, failure: 0 };
		this.activeUsers = 0;

		this.pizzaSold = 0;
		this.pizzaFailures = 0;
		this.pizzaRevenueCents = 0;

		this.lastPizzaLatencyMs = 0;
		this.endpointLatency = new Map();
	}

	requestTracker(req, res, next) {
		const start = Date.now();

		res.on("finish", () => {
			const durationMs = Date.now() - start;
			const method = req.method;
			const route = req.route?.path || req.baseUrl || req.path || "unknown";
			const statusGroup = `${Math.floor(res.statusCode / 100)}xx`;

			const key = `${method}|${route}|${statusGroup}`;
			const current = this.httpCounts.get(key) || 0;
			this.httpCounts.set(key, current + 1);

			this.endpointLatency.set(route, durationMs);
		});

		next();
	}

	authAttempt(success) {
		if (success) this.authCounts.success += 1;
		else this.authCounts.failure += 1;
	}

	setActiveUsers(count) {
		this.activeUsers = count;
	}

	pizzaPurchase(success, latencyMs, priceCents, quantity = 1) {
		this.lastPizzaLatencyMs = latencyMs;

		if (success) {
			this.pizzaSold += quantity;
			this.pizzaRevenueCents += priceCents;
		} else {
			this.pizzaFailures += 1;
		}
	}

	getCpuUsagePercentage() {
		const cpuUsage = os.loadavg()[0] / os.cpus().length;
		return Math.round(cpuUsage * 100);
	}

	getMemoryUsagePercentage() {
		const total = os.totalmem();
		const free = os.freemem();
		const used = total - free;
		return Math.round((used / total) * 100);
	}

	buildMetric(name, type, unit, value, attributes = []) {
		return {
			name,
			unit,
			[type]: {
				dataPoints: [
					{
						asInt: Number.isInteger(value) ? value : Math.floor(value),
						asDouble: Number(value),
						timeUnixNano: Date.now() * 1000000,
						attributes,
					},
				],
				...(type === "sum"
					? {
							aggregationTemporality: "AGGREGATION_TEMPORALITY_CUMULATIVE",
							isMonotonic: true,
						}
					: {}),
			},
		};
	}

	async sendToGrafana() {
		const metrics = [];

		const { DB } = require("./database/database.js");
		try {
			const activeCount = await DB.getActiveUsers(5);
			this.setActiveUsers(activeCount);
		} catch (err) {
			console.error("Failed to get active users", err);
		}

		// Debug log active users retrieval for troubleshooting
		try {
			console.log("metrics: activeCount=", this.activeUsers);
		} catch (e) {
			console.error("metrics: failed to log active users", e);
		}

		for (const [key, value] of this.httpCounts.entries()) {
			const [method, route, statusGroup] = key.split("|");
			metrics.push(
				this.buildMetric("http_requests", "sum", "1", value, [
					{ key: "source", value: { stringValue: config.metrics.source } },
					{ key: "method", value: { stringValue: method } },
					{ key: "route", value: { stringValue: route } },
					{ key: "status_group", value: { stringValue: statusGroup } },
				]),
			);
		}

		metrics.push(
			this.buildMetric("auth_attempts", "sum", "1", this.authCounts.success, [
				{ key: "source", value: { stringValue: config.metrics.source } },
				{ key: "result", value: { stringValue: "success" } },
			]),
		);

		metrics.push(
			this.buildMetric("auth_attempts", "sum", "1", this.authCounts.failure, [
				{ key: "source", value: { stringValue: config.metrics.source } },
				{ key: "result", value: { stringValue: "failure" } },
			]),
		);

		metrics.push(
			this.buildMetric("active_users", "gauge", "1", this.activeUsers, [
				{ key: "source", value: { stringValue: config.metrics.source } },
			]),
		);

		metrics.push(
			this.buildMetric(
				"cpu_percent",
				"gauge",
				"%",
				this.getCpuUsagePercentage(),
				[{ key: "source", value: { stringValue: config.metrics.source } }],
			),
		);

		metrics.push(
			this.buildMetric(
				"memory_percent",
				"gauge",
				"%",
				this.getMemoryUsagePercentage(),
				[{ key: "source", value: { stringValue: config.metrics.source } }],
			),
		);

		metrics.push(
			this.buildMetric("pizza_sold", "sum", "1", this.pizzaSold, [
				{ key: "source", value: { stringValue: config.metrics.source } },
			]),
		);

		metrics.push(
			this.buildMetric(
				"pizza_creation_failures",
				"sum",
				"1",
				this.pizzaFailures,
				[{ key: "source", value: { stringValue: config.metrics.source } }],
			),
		);

		metrics.push(
			this.buildMetric(
				"pizza_revenue_cents",
				"sum",
				"1",
				this.pizzaRevenueCents,
				[{ key: "source", value: { stringValue: config.metrics.source } }],
			),
		);

		metrics.push(
			this.buildMetric(
				"pizza_creation_latency_ms",
				"gauge",
				"ms",
				this.lastPizzaLatencyMs,
				[{ key: "source", value: { stringValue: config.metrics.source } }],
			),
		);

		for (const [route, latency] of this.endpointLatency.entries()) {
			metrics.push(
				this.buildMetric(
					"service_endpoint_latency_ms",
					"gauge",
					"ms",
					latency,
					[
						{ key: "source", value: { stringValue: config.metrics.source } },
						{ key: "route", value: { stringValue: route } },
					],
				),
			);
		}

		const body = JSON.stringify({
			resourceMetrics: [
				{
					resource: {
						attributes: [
							{
								key: "service.name",
								value: { stringValue: config.metrics.source },
							},
						],
					},
					scopeMetrics: [
						{
							scope: { name: "jwt-pizza-service" },
							metrics,
						},
					],
				},
			],
		});

		// Debug: log payload size and a short preview before sending
		try {
			console.log(
				"metrics: sending payload size=",
				Buffer.byteLength(body),
				"bytes",
			);
			// log just the active_users metric entry for quick inspection
			try {
				const parsed = JSON.parse(body);
				const preview =
					parsed.resourceMetrics?.[0]?.scopeMetrics?.[0]?.metrics?.find(
						(m) => m.name === "active_users",
					);
				console.log("metrics: active_users payload preview=", preview);
			} catch (e) {}
			try {
				const parsed = JSON.parse(body);
				const preview =
					parsed.resourceMetrics?.[0]?.scopeMetrics?.[0]?.metrics?.find(
						(m) => m.name === "active_users",
					);
				if (preview) {
					const dp = preview.gauge?.dataPoints?.[0];
					console.log("metrics: active_users payload preview=", {
						name: preview.name,
						unit: preview.unit,
						value: dp?.asInt,
						attributes: dp?.attributes,
					});
				} else {
					console.log(
						"metrics: active_users metric not found in payload preview",
					);
				}
			} catch (e) {
				console.error("metrics: failed to parse payload preview", e);
			}
		} catch (e) {
			console.error("metrics: failed to log payload info", e);
		}

		const response = await fetch(config.metrics.endpointUrl, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Basic ${Buffer.from(
					`${config.metrics.accountId}:${config.metrics.apiKey}`,
				).toString("base64")}`,
			},
			body,
		});

		// Read response body once and log status + body for debugging
		try {
			const respText = await response.text();
			console.log(
				"metrics: push response status=",
				response.status,
				"ok=",
				response.ok,
			);
			console.log("metrics: push response body=", respText);
			if (!response.ok) {
				console.error("Failed to push metrics:", respText);
			}
		} catch (e) {
			console.error("metrics: failed to read response body", e);
		}

		if (!response.ok) {
			const text = await response.text();
			console.error("Failed to push metrics:", text);
		}
	}

	start(periodMs = 5000) {
		setInterval(async () => {
			try {
				await this.sendToGrafana();
			} catch (err) {
				console.error("Error sending metrics", err);
			}
		}, periodMs);
	}
}

module.exports = new Metrics();

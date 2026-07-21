// Shared formatters and constants used across the calculator and dashboard.
const number = new Intl.NumberFormat("en-US");
const percent = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });
const frankfurterApi = "https://api.frankfurter.dev/v2";

// Starter data keeps the dashboard useful before a user pastes or uploads campaign rows.
const sampleCampaignData = `campaign,budget,spend,impressions,clicks,conversions
Awareness Prospecting,25000,17850,4200000,12620,310
Retargeting Display,12000,9840,1180000,8850,522
CTV Reach,40000,31100,2100000,1840,93
Retail Media,18000,14250,960000,6120,280`;

// Pixel QA checklist sections are rendered into interactive checkboxes on load.
const qaGroups = [
  {
    title: "Base pixels",
    items: [
      "Base pixel fires on all required pages",
      "Pixel ID matches the media plan",
      "Consent mode or CMP behavior is confirmed"
    ]
  },
  {
    title: "Conversion events",
    items: [
      "Primary conversion event fires once",
      "Revenue or order value is passed where required",
      "Deduplication keys are present"
    ]
  },
  {
    title: "GTM setup",
    items: [
      "Container ID matches the approved environment",
      "Trigger conditions exclude test pages",
      "Preview mode shows the expected tag sequence"
    ]
  },
  {
    title: "Network requests",
    items: [
      "Requests return successful status codes",
      "Required query parameters are populated",
      "No blocked third-party requests in console"
    ]
  }
];

function safeDivide(numerator, denominator) {
  // KPI metrics should show 0 instead of Infinity when the source metric is empty.
  return denominator > 0 ? numerator / denominator : 0;
}

function readNumber(id) {
  return Number(document.getElementById(id).value) || 0;
}

function getCurrencySettings() {
  // Manual mode supports contracted rates; live mode uses Frankfurter reference rates.
  const rateSource = document.getElementById("rate-source").value;
  const source = document.getElementById("source-currency").value;
  const target = document.getElementById("target-currency").value;
  const enteredRate = Number(document.getElementById("exchange-rate").value);
  const rate = enteredRate > 0 ? enteredRate : 1;

  return { rateSource, source, target, rate };
}

function convertedMoney(value) {
  const { source, target, rate } = getCurrencySettings();
  return source === target ? value : value * rate;
}

function formatMoney(value) {
  const { target } = getCurrencySettings();

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: target
  }).format(convertedMoney(value));
}

function updateCurrencyStatus() {
  const { rateSource, source, target, rate } = getCurrencySettings();
  const status = document.getElementById("currency-status");

  status.textContent = source === target
    ? `Values are displayed in ${target} without conversion.`
    : `Values are converted from ${source} to ${target} at ${rate} ${target} per 1 ${source} using ${rateSource === "live" ? "a live reference rate" : "a contracted/manual rate"}.`;
}

function updateRateSourceState() {
  const { rateSource } = getCurrencySettings();
  const rateInput = document.getElementById("exchange-rate");
  const fetchButton = document.getElementById("fetch-rate");

  rateInput.readOnly = rateSource === "live";
  fetchButton.disabled = rateSource !== "live";
  updateCurrencyStatus();
}

function updateMoneyViews() {
  // Currency changes affect every money metric in the KPI calculator and dashboard.
  updateRateSourceState();
  updateCurrencyStatus();
  updateKpis();
  updateDashboard();
}

async function fetchLiveExchangeRate() {
  // Frankfurter returns public reference rates only; manual input remains the fallback.
  const { source, target } = getCurrencySettings();
  const status = document.getElementById("live-rate-status");
  const button = document.getElementById("fetch-rate");
  const rateInput = document.getElementById("exchange-rate");

  if (source === target) {
    rateInput.value = "1";
    status.textContent = "Matching currencies use a 1.0000 rate.";
    updateMoneyViews();
    return;
  }

  button.disabled = true;
  status.textContent = `Fetching ${source} to ${target} from Frankfurter...`;

  try {
    const response = await fetch(`${frankfurterApi}/rate/${source}/${target}`);
    const data = await response.json();

    if (!response.ok || data.base !== source || data.quote !== target || typeof data.rate !== "number") {
      throw new Error(data.message || "Unexpected rate response");
    }

    rateInput.value = data.rate;
    status.textContent = `Reference rate updated from Frankfurter for ${data.date}.`;
    updateMoneyViews();
  } catch (error) {
    status.textContent = `Live rate unavailable. Use a manual contracted rate. ${error.message}`;
  } finally {
    button.disabled = document.getElementById("rate-source").value !== "live";
  }
}

function metricCard(label, value, note = "") {
  return `<article class="metric-card"><span>${label}</span><strong>${value}</strong><small>${note}</small></article>`;
}

// Campaign KPI calculator.
function updateKpis() {
  const spend = readNumber("spend");
  const impressions = readNumber("impressions");
  const clicks = readNumber("clicks");
  const conversions = readNumber("conversions");
  const ctr = safeDivide(clicks, impressions) * 100;
  const cpc = safeDivide(spend, clicks);
  const cpa = safeDivide(spend, conversions);
  const cpm = safeDivide(spend, impressions) * 1000;

  document.getElementById("kpi-results").innerHTML = [
    metricCard("CTR", `${percent.format(ctr)}%`, "Clicks divided by impressions"),
    metricCard("CPC", formatMoney(cpc), "Spend divided by clicks"),
    metricCard("CPA", formatMoney(cpa), "Spend divided by conversions"),
    metricCard("CPM", formatMoney(cpm), "Spend per 1,000 impressions")
  ].join("");
}

// UTM builder.
function updateUtm() {
  const base = document.getElementById("base-url").value.trim();
  const output = document.getElementById("utm-output");

  try {
    const url = new URL(base);
    const fields = [
      ["utm_source", "utm-source"],
      ["utm_medium", "utm-medium"],
      ["utm_campaign", "utm-campaign"],
      ["utm_term", "utm-term"],
      ["utm_content", "utm-content"]
    ];

    fields.forEach(([param, id]) => {
      const value = document.getElementById(id).value.trim();
      if (value) {
        url.searchParams.set(param, value);
      }
    });

    output.value = url.toString();
  } catch {
    output.value = "Enter a valid landing page URL.";
  }
}

// Pixel QA checklist.
function renderQaChecklist() {
  const list = document.getElementById("qa-list");
  list.innerHTML = qaGroups.map((group, groupIndex) => `
    <section class="check-group">
      <h3>${group.title}</h3>
      ${group.items.map((item, itemIndex) => {
        const id = `qa-${groupIndex}-${itemIndex}`;
        return `<label class="check-item" for="${id}"><input id="${id}" type="checkbox" data-qa>${item}</label>`;
      }).join("")}
    </section>
  `).join("");
  list.addEventListener("change", updateQaProgress);
  updateQaProgress();
}

function updateQaProgress() {
  const checks = [...document.querySelectorAll("[data-qa]")];
  const complete = checks.filter((check) => check.checked).length;
  const total = checks.length;
  const completion = total ? (complete / total) * 100 : 0;
  document.getElementById("qa-count").textContent = `${complete} of ${total} complete`;
  document.getElementById("qa-progress").style.width = `${completion}%`;
}

// Campaign dashboard data parsing.
function parseCsv(text) {
  // This parser is intentionally lightweight for simple pasted/exported CSV rows.
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) {
    return [];
  }

  const headers = lines[0].split(",").map((header) => header.trim());
  return lines.slice(1).map((line) => {
    const cells = line.split(",").map((cell) => cell.trim());
    return headers.reduce((row, header, index) => {
      row[header] = cells[index] || "";
      return row;
    }, {});
  });
}

function parseCampaignData(text) {
  // Accept either pasted JSON or CSV so the dashboard can work with common exports.
  const trimmed = text.trim();
  if (!trimmed) {
    return [];
  }

  if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
    const parsed = JSON.parse(trimmed);
    return Array.isArray(parsed) ? parsed : parsed.campaigns || [];
  }

  return parseCsv(trimmed);
}

function normalizedCampaign(row) {
  // Normalize a few common column names before calculating delivery metrics.
  return {
    campaign: row.campaign || row.name || "Untitled campaign",
    budget: Number(row.budget) || 0,
    spend: Number(row.spend) || 0,
    impressions: Number(row.impressions) || Number(row.imps) || 0,
    clicks: Number(row.clicks) || 0,
    conversions: Number(row.conversions) || Number(row.conv) || 0
  };
}

// Campaign dashboard rendering.
function updateDashboard() {
  const input = document.getElementById("campaign-input");
  const table = document.getElementById("campaign-table");
  const summary = document.getElementById("dashboard-summary");

  try {
    const campaigns = parseCampaignData(input.value).map(normalizedCampaign);
    const totals = campaigns.reduce((acc, campaign) => {
      acc.budget += campaign.budget;
      acc.spend += campaign.spend;
      acc.impressions += campaign.impressions;
      acc.clicks += campaign.clicks;
      acc.conversions += campaign.conversions;
      return acc;
    }, { budget: 0, spend: 0, impressions: 0, clicks: 0, conversions: 0 });

    summary.innerHTML = [
      metricCard("Total spend", formatMoney(totals.spend), `${percent.format(safeDivide(totals.spend, totals.budget) * 100)}% of budget`),
      metricCard("Impressions", number.format(totals.impressions), "Delivered media volume"),
      metricCard("CTR", `${percent.format(safeDivide(totals.clicks, totals.impressions) * 100)}%`, `${number.format(totals.clicks)} clicks`),
      metricCard("CPA", formatMoney(safeDivide(totals.spend, totals.conversions)), `${number.format(totals.conversions)} conversions`)
    ].join("");

    table.innerHTML = campaigns.map((campaign) => {
      const pacing = safeDivide(campaign.spend, campaign.budget) * 100;
      const ctr = safeDivide(campaign.clicks, campaign.impressions) * 100;
      const cpa = safeDivide(campaign.spend, campaign.conversions);
      const cpm = safeDivide(campaign.spend, campaign.impressions) * 1000;
      return `
        <tr>
          <td>${campaign.campaign}</td>
          <td class="pace">${percent.format(pacing)}%<span class="pace-bar"><span style="width: ${Math.min(pacing, 100)}%"></span></span></td>
          <td>${formatMoney(campaign.spend)}</td>
          <td>${number.format(campaign.impressions)}</td>
          <td>${percent.format(ctr)}%</td>
          <td>${formatMoney(cpa)}</td>
          <td>${formatMoney(cpm)}</td>
        </tr>
      `;
    }).join("");
  } catch (error) {
    summary.innerHTML = metricCard("Data error", "Invalid input", error.message);
    table.innerHTML = "";
  }
}

// Ad tag formatter and validator.
function validateAdTag() {
  const tag = document.getElementById("tag-input").value;
  const checks = [
    {
      label: "Click tracker",
      passed: /(clicktag|clickTAG|click=|click_url|CLICK_URL|%%CLICK)/.test(tag),
      help: "Looked for clickTag, click URL, or platform click macro."
    },
    {
      label: "Cachebuster",
      passed: /(cachebuster|cb=|ord=|timestamp|random|CACHEBUSTER)/i.test(tag),
      help: "Looked for cachebuster or randomization parameter."
    },
    {
      label: "Macros",
      passed: /(\$\{[^}]+\}|%%[^%]+%%|\[[^\]]+\])/.test(tag),
      help: "Looked for common macro placeholders."
    },
    {
      label: "Dimensions",
      passed: /(width=["']?\d+|height=["']?\d+|sz=\d+x\d+|\d+x\d+)/i.test(tag),
      help: "Looked for width, height, or size values."
    },
    {
      label: "Secure URL",
      passed: !/http:\/\//i.test(tag) && /https:\/\//i.test(tag),
      warning: true,
      help: "Tags should avoid insecure HTTP assets."
    }
  ];

  document.getElementById("tag-results").innerHTML = checks.map((check) => {
    const status = check.passed ? "good" : check.warning ? "warn" : "bad";
    const text = check.passed ? "Present" : check.warning ? "Review" : "Missing";
    return `<div class="validation-item"><span class="status ${status}">${text}</span><div><strong>${check.label}</strong><br>${check.help}</div></div>`;
  }).join("");
}

// OpenRTB-style JSON viewer.
function updateJsonViewer() {
  const input = document.getElementById("json-input").value.trim();
  const error = document.getElementById("json-error");
  const fields = document.getElementById("json-fields");

  if (!input) {
    error.textContent = "";
    fields.innerHTML = "";
    return;
  }

  try {
    const json = JSON.parse(input);
    const imp = Array.isArray(json.imp) ? json.imp[0] || {} : {};
    const banner = imp.banner || {};
    const video = imp.video || {};
    const siteOrApp = json.site || json.app || {};
    const fieldData = {
      "Request ID": json.id,
      "Impressions": Array.isArray(json.imp) ? json.imp.length : 0,
      "Inventory": siteOrApp.domain || siteOrApp.name || siteOrApp.bundle,
      "Device": json.device?.ua || json.device?.devicetype,
      "Geo": [json.device?.geo?.country, json.device?.geo?.region, json.device?.geo?.city].filter(Boolean).join(", "),
      "User ID": json.user?.id || json.user?.buyeruid,
      "Currency": Array.isArray(json.cur) ? json.cur.join(", ") : json.cur,
      "Timeout": json.tmax ? `${json.tmax} ms` : undefined,
      "Bidfloor": imp.bidfloor,
      "Ad size": banner.w && banner.h ? `${banner.w}x${banner.h}` : video.w && video.h ? `${video.w}x${video.h}` : undefined
    };

    error.textContent = "";
    fields.innerHTML = Object.entries(fieldData).map(([label, value]) => (
      `<div class="field-item"><strong>${label}</strong><span>${value || "Not provided"}</span></div>`
    )).join("");
  } catch (parseError) {
    error.textContent = parseError.message;
    fields.innerHTML = "";
  }
}

// Tool navigation.
function initTabs() {
  document.querySelectorAll(".tab-button").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll(".tab-button").forEach((tab) => tab.classList.remove("is-active"));
      document.querySelectorAll(".tool-panel").forEach((panel) => panel.classList.remove("is-active"));
      button.classList.add("is-active");
      document.getElementById(button.dataset.tab).classList.add("is-active");
    });
  });
}

// App bootstrapping and event wiring.
function init() {
  initTabs();
  renderQaChecklist();
  document.getElementById("currency-form").addEventListener("input", updateMoneyViews);
  document.getElementById("rate-source").addEventListener("change", () => {
    updateMoneyViews();
    if (document.getElementById("rate-source").value === "live") {
      fetchLiveExchangeRate();
    }
  });
  document.getElementById("source-currency").addEventListener("change", () => {
    if (document.getElementById("rate-source").value === "live") {
      fetchLiveExchangeRate();
    }
  });
  document.getElementById("target-currency").addEventListener("change", () => {
    if (document.getElementById("rate-source").value === "live") {
      fetchLiveExchangeRate();
    }
  });
  document.getElementById("fetch-rate").addEventListener("click", fetchLiveExchangeRate);
  document.getElementById("kpi-form").addEventListener("input", updateKpis);
  document.getElementById("utm-form").addEventListener("input", updateUtm);
  document.getElementById("copy-utm").addEventListener("click", async () => {
    await navigator.clipboard.writeText(document.getElementById("utm-output").value);
  });
  document.getElementById("reset-qa").addEventListener("click", () => {
    document.querySelectorAll("[data-qa]").forEach((check) => {
      check.checked = false;
    });
    updateQaProgress();
  });
  document.getElementById("load-sample").addEventListener("click", () => {
    document.getElementById("campaign-input").value = sampleCampaignData;
    updateDashboard();
  });
  document.getElementById("campaign-input").addEventListener("input", updateDashboard);
  document.getElementById("campaign-file").addEventListener("change", async (event) => {
    const file = event.target.files[0];
    if (file) {
      document.getElementById("campaign-input").value = await file.text();
      updateDashboard();
    }
  });
  document.getElementById("tag-input").addEventListener("input", validateAdTag);
  document.getElementById("json-input").addEventListener("input", updateJsonViewer);

  document.getElementById("campaign-input").value = sampleCampaignData;
  document.getElementById("tag-input").value = '<iframe src="https://adserver.example.com/ad?sz=300x250&click=${CLICK_URL}&cb=${CACHEBUSTER}" width="300" height="250"></iframe>';
  document.getElementById("json-input").value = JSON.stringify({
    id: "req-123",
    tmax: 120,
    cur: ["USD"],
    imp: [{ bidfloor: 2.5, banner: { w: 300, h: 250 } }],
    site: { domain: "publisher.example" },
    device: { ua: "Mozilla/5.0", geo: { country: "US", region: "NY" } },
    user: { id: "user-789" }
  }, null, 2);

  updateCurrencyStatus();
  updateRateSourceState();
  updateKpis();
  updateUtm();
  updateDashboard();
  validateAdTag();
  updateJsonViewer();
}

document.addEventListener("DOMContentLoaded", init);

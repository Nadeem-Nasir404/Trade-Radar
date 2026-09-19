// Table-based layout with every style attribute inlined (not a <style> block) - the only markup
// pattern that renders consistently across Gmail, Outlook, and Apple Mail. Gradients get a solid
// background-color fallback for clients (old Outlook) that ignore CSS gradients entirely.

const BRAND = "#a855f7";
const BRAND_DARK = "#7c3aed";

const UPWARD_CONDITIONS = new Set(["ABOVE", "CROSSES_ABOVE", "ENTERS_RANGE"]);

export interface AlertEmailParams {
  symbol: string;
  conditionType: string;
  conditionText: string;
  observedPrice: string;
  alertsUrl: string;
  userName: string | null;
}

export function buildAlertEmailHtml(params: AlertEmailParams): string {
  const { symbol, conditionType, conditionText, observedPrice, alertsUrl, userName } = params;
  const isUp = UPWARD_CONDITIONS.has(conditionType);
  const accent = isUp ? "#22c55e" : "#f43f5e";
  const accentSoft = isUp ? "rgba(34,197,94,0.15)" : "rgba(244,63,94,0.15)";
  const arrow = isUp ? "&#9650;" : "&#9660;";
  const greeting = userName ? `Hey ${escapeHtml(userName)},` : "Hey,";

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="dark" />
    <title>${escapeHtml(symbol)} price alert</title>
  </head>
  <body style="margin:0;padding:0;background-color:#000000;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#000000;">
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background-color:#0a0a0a;border-radius:20px;border:1px solid rgba(255,255,255,0.08);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
            <tr>
              <td style="padding:28px 32px 0 32px;">
                <table role="presentation" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="width:32px;height:32px;border-radius:10px;background-color:${BRAND};background-image:linear-gradient(135deg,${BRAND},${BRAND_DARK});text-align:center;vertical-align:middle;font-size:16px;line-height:32px;">&#128276;</td>
                    <td style="padding-left:10px;color:#ffffff;font-size:17px;font-weight:700;">CoinRadar</td>
                  </tr>
                </table>
              </td>
            </tr>

            <tr>
              <td style="padding:22px 32px 0 32px;color:#a0a0a0;font-size:14px;">${greeting}</td>
            </tr>

            <tr>
              <td style="padding:6px 32px 0 32px;">
                <span style="display:inline-block;padding:4px 10px;border-radius:999px;background-color:${accentSoft};color:${accent};font-size:12px;font-weight:700;letter-spacing:0.02em;">
                  ${arrow} PRICE ALERT TRIGGERED
                </span>
              </td>
            </tr>

            <tr>
              <td style="padding:12px 32px 0 32px;">
                <div style="color:#ffffff;font-size:22px;font-weight:700;">${escapeHtml(symbol)}</div>
                <div style="color:#a0a0a0;font-size:14px;margin-top:2px;">${escapeHtml(conditionText)}</div>
              </td>
            </tr>

            <tr>
              <td style="padding:20px 32px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:14px;">
                  <tr>
                    <td style="padding:18px 20px;">
                      <div style="color:#5c5c5c;font-size:11px;text-transform:uppercase;letter-spacing:0.06em;">Observed Price</div>
                      <div style="color:#ffffff;font-size:32px;font-weight:700;font-variant-numeric:tabular-nums;margin-top:4px;">$${escapeHtml(observedPrice)}</div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <tr>
              <td style="padding:4px 32px 8px 32px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td align="center" style="border-radius:12px;background-color:${BRAND};background-image:linear-gradient(135deg,${BRAND},${BRAND_DARK});">
                      <a href="${alertsUrl}" style="display:block;padding:14px 0;color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;">View your alerts</a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <tr>
              <td style="padding:20px 32px 28px 32px;border-top:1px solid rgba(255,255,255,0.06);">
                <div style="color:#5c5c5c;font-size:12px;line-height:18px;padding-top:16px;">
                  You're receiving this because you set a price alert on CoinRadar. Manage alerts and notification preferences anytime from the Profile tab in the app.
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export function buildAlertEmailText(params: AlertEmailParams): string {
  return `${params.symbol} ${params.conditionText}\nObserved price: $${params.observedPrice}\n\nView your alerts: ${params.alertsUrl}`;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

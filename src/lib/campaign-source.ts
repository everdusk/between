/** Only public campaign labels are analytics data; never forward arbitrary start payloads. */
export function telegramCampaignSource(payload: string | null) {
  const match = /^tg_(telegain|ads)_([a-z0-9_]{1,48})$/.exec(payload ?? "");
  if (!match || !payload || payload.length > 64) return null;
  return {
    campaign_source: "telegram",
    campaign_medium: match[1] === "ads" ? "sponsored_message" : "paid_post",
    campaign_platform: match[1] === "ads" ? "telegram_ads" : "telegain",
    campaign_name: match[2],
    campaign_tag: payload,
  };
}

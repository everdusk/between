/** Only public campaign labels are analytics data; never forward arbitrary start payloads. */
export function telegramCampaignSource(payload: string | null) {
  const match = /^tg_telegain_([a-z0-9_]{1,48})$/.exec(payload ?? "");
  if (!match || !payload || payload.length > 64) return null;
  return {
    campaign_source: "telegram",
    campaign_medium: "paid_post",
    campaign_platform: "telegain",
    campaign_name: match[1],
    campaign_tag: payload,
  };
}

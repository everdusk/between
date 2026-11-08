import QRCode from "qrcode";

/** Dark modules on a transparent tile. The card behind it is the light background a camera needs. */
export async function landingQrSvg(url: string): Promise<string> {
  const svg = await QRCode.toString(url, {
    type: "svg",
    margin: 0,
    errorCorrectionLevel: "M",
    color: { dark: "#062018", light: "#00000000" },
  });
  return svg.replace("<svg ", '<svg class="bl-qr-svg" aria-hidden="true" ');
}

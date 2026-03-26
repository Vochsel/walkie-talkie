import QRCode from 'qrcode';

export async function generateConnectionQR(
  baseUrl: string,
  token: string
): Promise<string> {
  const connectionUrl = `${baseUrl}?token=${encodeURIComponent(token)}`;
  return QRCode.toDataURL(connectionUrl, {
    width: 280,
    margin: 2,
    color: {
      dark: '#000000',
      light: '#ffffff',
    },
  });
}

export function buildConnectionUrl(baseUrl: string, token: string): string {
  return `${baseUrl}?token=${encodeURIComponent(token)}`;
}

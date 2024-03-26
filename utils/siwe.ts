import { extractHostname, getBrowserUrl, listObject } from "./misc";

export function formatAuthMessage(
  address: string,
  chainId: number
) {
  const url = getBrowserUrl();

  const now = Date.now();
  const domain = extractHostname(url);

  const params = {
    URI: url,
    "Issued At": new Date(now).toISOString(),
    "Chain ID": chainId,
  };

  const lines = [
    `${domain} wants you to sign in with your Ethereum account:`,
    address,
    "",
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    ...listObject(params),
  ];

  const message = lines.join("\n");

  return message;
}

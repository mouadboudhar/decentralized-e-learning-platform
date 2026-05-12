export async function uploadJSON(data) {
  const apiKey = import.meta.env.VITE_PINATA_API_KEY;
  const secret = import.meta.env.VITE_PINATA_SECRET;

  if (apiKey && secret) {
    const response = await fetch("https://api.pinata.cloud/pinning/pinJSONToIPFS", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        pinata_api_key: apiKey,
        pinata_secret_api_key: secret,
      },
      body: JSON.stringify({ pinataContent: data }),
    });
    const result = await response.json();
    return result.IpfsHash;
  }

  // No Pinata configured: embed the metadata inline as a data: URI so it still
  // round-trips without any external service. Stored on-chain as the "ipfsHash".
  return "data:application/json;base64," + btoa(JSON.stringify(data));
}

export function ipfsToHttp(hash) {
  // Inline data: URIs are fetchable as-is by the browser.
  if (typeof hash === "string" && hash.startsWith("data:")) return hash;
  return `https://gateway.pinata.cloud/ipfs/${hash}`;
}

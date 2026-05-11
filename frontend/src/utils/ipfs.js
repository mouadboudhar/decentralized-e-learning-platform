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

  return "Qm" + btoa(JSON.stringify(data)).replace(/[^a-zA-Z0-9]/g, "").slice(0, 44);
}

export function ipfsToHttp(hash) {
  return `https://gateway.pinata.cloud/ipfs/${hash}`;
}

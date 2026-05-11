import { useMemo } from "react";
import { ethers } from "ethers";
import {
  COURSE_REGISTRY_ADDRESS,
  COURSE_REGISTRY_ABI,
  CERTIFICATE_NFT_ADDRESS,
  CERTIFICATE_NFT_ABI,
} from "../utils/contracts";

export function useContract(signer) {
  const courseRegistry = useMemo(() => {
    if (!signer) return null;
    return new ethers.Contract(COURSE_REGISTRY_ADDRESS, COURSE_REGISTRY_ABI, signer);
  }, [signer]);

  const certificateNFT = useMemo(() => {
    if (!signer) return null;
    return new ethers.Contract(CERTIFICATE_NFT_ADDRESS, CERTIFICATE_NFT_ABI, signer);
  }, [signer]);

  return { courseRegistry, certificateNFT };
}

import { createServerFn } from "@tanstack/react-start";

export const getScanditLicenseKey = createServerFn({ method: "GET" }).handler(
  async () => {
    const key = process.env.SCANDIT_LICENSE_KEY;
    if (!key) {
      throw new Error("SCANDIT_LICENSE_KEY is not configured");
    }
    return { licenseKey: key };
  },
);

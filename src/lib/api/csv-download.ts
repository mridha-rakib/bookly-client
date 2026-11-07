import { apiClient } from "@/lib/api/client";

export async function downloadCsv(url: string, params: Record<string, unknown>, filename: string) {
  const response = await apiClient.get<Blob>(url, { params, responseType: "blob", headers: { Accept: "text/csv" } });
  const objectUrl = URL.createObjectURL(response.data);
  const link = document.createElement("a"); link.href = objectUrl; link.download = filename;
  document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}

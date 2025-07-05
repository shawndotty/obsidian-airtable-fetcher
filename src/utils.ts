// base64 编码
export function encodeBase64(str: string): string {
	if (!str) return "";
	try {
		return btoa(encodeURIComponent(str));
	} catch (e) {
		console.error("Base64 编码失败", e);
		return str;
	}
}

// base64 解码
export function decodeBase64(str: string): string {
	if (!str) return "";
	try {
		return decodeURIComponent(atob(str));
	} catch (e) {
		console.error("Base64 解码失败", e);
		return str;
	}
}

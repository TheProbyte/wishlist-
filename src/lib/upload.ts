/**
 * Your own photo of a gift: shrunk in the browser (max 1200px, JPEG) so it uploads fast and
 * stays small, then stored by the app.
 */
export async function uploadPhoto(file: File): Promise<string> {
	const bitmap = await createImageBitmap(file);
	const scale = Math.min(1, 1200 / Math.max(bitmap.width, bitmap.height));
	const canvas = document.createElement('canvas');
	canvas.width = Math.round(bitmap.width * scale);
	canvas.height = Math.round(bitmap.height * scale);
	canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
	let quality = 0.85;
	let blob: Blob | null = null;
	// Keep it under ~700KB.
	do {
		blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', quality));
		quality -= 0.15;
	} while (blob && blob.size > 700_000 && quality > 0.3);
	if (!blob) throw new Error('Couldn’t read that photo.');
	const res = await fetch('/api/images', { method: 'POST', headers: { 'content-type': 'image/jpeg' }, body: blob });
	if (!res.ok) throw new Error(((await res.json().catch(() => null)) as { error?: string } | null)?.error ?? 'Upload failed.');
	return ((await res.json()) as { url: string }).url;
}

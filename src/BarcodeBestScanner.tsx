/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef, useState } from "react";
import { enumerateRearCameras, selectBestRearCamera, type CameraInfo } from "./camera-utils";

declare global { interface Window { ZXing: any; } }

export default function BarcodeScanner() {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    const [cams, setCams] = useState<CameraInfo[]>([]);
    const [activeId, setActiveId] = useState<string | null>(null);
    const [result, setResult] = useState<string>("");
    const [autoDiag, setAutoDiag] = useState<any[]>([]);

    // Load ZXing WASM
    useEffect(() => {
        if (!window.ZXing) {
            const script = document.createElement("script");
            script.src = "/zxing_reader.js";
            script.onload = () => {
                window.ZXing().then((ins: any) => {
                    window.zxing = ins;
                    // alert(ins);
                });
            };
            document.body.appendChild(script);
        }
    }, []);

    // Enumerate rear cameras + auto-pick best
    const startCamera = async () => {
        const rear = await enumerateRearCameras();
        setCams(rear);

        if (rear.length === 0) return;

        const { deviceId, suggestedConstraints, diagnostics } = await selectBestRearCamera(rear);
        setActiveId(deviceId);
        setAutoDiag(diagnostics);

        const stream = await navigator.mediaDevices.getUserMedia({ video: suggestedConstraints });
        const video = videoRef.current!;
        video.srcObject = stream;

        // Optional torch for low light
        // const track = stream.getVideoTracks()[0];
        // const caps = track.getCapabilities?.() as any;
        // if (caps?.torch) {
        //     try { await track.applyConstraints({ advanced: [{ torch: true }] as any }); } catch (e) { console.error(e); }
        // }

        await scan();
    };


    const switchCam = async (deviceId: string) => {
        setActiveId(deviceId);
        const current = (videoRef.current?.srcObject as MediaStream | null);
        current?.getTracks().forEach(t => t.stop());

        const stream = await navigator.mediaDevices.getUserMedia({
            video: {
                deviceId: { exact: deviceId },
                // width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 15 },
                // advanced: [{ focusMode: "continuous" as any } as any]
            }
        });
        videoRef.current!.srcObject = stream;
    };

    const scan = async () => {
        const video = videoRef.current;
        const canvas = canvasRef.current;

        if (!video || !canvas || !window.ZXing || video.readyState < 2) {
            return setTimeout(scan, 200);
        }

        const w = video.videoWidth, h = video.videoHeight;
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext("2d")!;

        // Crop center (70%) to speed up
        const cw = Math.floor(w * 0.7), ch = Math.floor(h * 0.7);
        const sx = Math.floor((w - cw) / 2), sy = Math.floor((h - ch) / 2);

        ctx.drawImage(video, sx, sy, cw, ch, 0, 0, cw, ch);
        const img = ctx.getImageData(0, ch * 0.35, cw, ch * 0.65);

        try {
            // const res = await window.ZXing.decodeBitmap(img.data, cw, ch);
            // if (res?.text && res.text !== result) setResult(res.text);

            const sourceBuffer = img.data;
            const zxing = window.zxing;

            if (zxing != null) {
                const buffer = zxing._malloc(sourceBuffer.byteLength);
                zxing.HEAPU8.set(sourceBuffer, buffer);
                const res = zxing.readBarcodeFromPixmap(buffer, cw, ch * 0.3, true, "");
                zxing._free(buffer);

                if (res?.text && res.text !== result) {
                    setResult(res.text);
                }
            }
        } catch { /* no code found this frame */ }

        requestAnimationFrame(scan);
        //setTimeout(scan, 400); // ~2.5 fps decode is plenty
    }

    return (
        <>
            <button onClick={startCamera} style={{ marginBottom: 10 }}>start</button>
            <div style={{ display: "grid", gap: 12 }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <label>Camera:</label>
                    <select
                        value={activeId ?? ""}
                        onChange={e => switchCam(e.target.value)}
                        style={{ padding: 6 }}
                    >
                        {cams.map(c => (
                            <option key={c.deviceId} value={c.deviceId}>
                                {c.label || c.deviceId}
                            </option>
                        ))}
                    </select>
                </div>

                <video ref={videoRef} autoPlay playsInline style={{ width: "100%", maxWidth: 520, outline: "2px solid #888" }} />
                <canvas ref={canvasRef} style={{ display: "none" }} />

                <div>
                    {result ? (
                        <div><strong>Decoded:</strong> {result}</div>
                    ) : (
                        <span>Point a barcode at the camera…</span>
                    )}
                </div>

                {/* Optional: diagnostics for debugging auto-pick */}
                {autoDiag.length > 0 && (
                    <details>
                        <summary>Auto‑selection diagnostics</summary>
                        <pre style={{ whiteSpace: "pre-wrap" }}>{JSON.stringify(autoDiag, null, 2)}</pre>
                    </details>
                )}
            </div>
        </>
    );
}

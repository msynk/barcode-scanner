/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef, useState } from "react";

declare global {
    interface Window { ZXing: any; zxing: any; }
}

const ZOOM = 0.2;
const HEIGHT_RATIO = 0.3;
const canvas = document.createElement("canvas");

export default function BarcodeScanner() {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [results, setResults] = useState<string[]>([]);

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

    const startCamera = async () => {
        if (!videoRef.current) return;

        try {
            // const devices = await navigator.mediaDevices.enumerateDevices();
            // const cameras = devices.filter(device => device.kind === "videoinput");

            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    // deviceId: { exact: cameras.length > 0 ? cameras[3].deviceId : undefined },
                    facingMode: "environment",
                    // width: { ideal: 3840 },
                    // height: { ideal: 2160 },
                    width: { min: 1400, ideal: 1920, max: 2160 },
                    height: { min: 900, ideal: 1080, max: 1440 }
                }, audio: false
            });
            videoRef.current.srcObject = stream;

            const [track] = stream.getVideoTracks();
            const capabilities = track.getCapabilities();
            // const settings = track.getSettings();

            // alert(JSON.stringify(capabilities));
            // alert(JSON.stringify(settings));

            if ((capabilities as any).zoom) {
                track.applyConstraints({
                    advanced: [{ zoom: (capabilities as any).zoom.max * ZOOM }]
                } as any);
            }

            await videoRef.current.play();

            await scan();
        } catch (e) {
            alert((e as Error).toString());
        }
    };

    async function scan() {
        if (
            window.ZXing && videoRef.current
        ) {
            const video = videoRef.current;

            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const ctx = canvas.getContext("2d");
            ctx?.drawImage(video, 0, 0, canvas.width, canvas.height);

            const imgWidth = canvas.width;
            const imgHeight = canvas.height;
            const imageData = ctx?.getImageData(0, imgHeight * (1 - HEIGHT_RATIO) / 2, imgWidth, imgHeight * ((1 + HEIGHT_RATIO) / 2));

            try {
                if (imageData) {
                    const sourceBuffer = imageData.data;
                    const zxing = window.zxing;
                    if (zxing != null) {
                        const buffer = zxing._malloc(sourceBuffer.byteLength);
                        zxing.HEAPU8.set(sourceBuffer, buffer);
                        const res = zxing.readBarcodeFromPixmap(buffer, imgWidth, imgHeight * HEIGHT_RATIO, true, "");
                        zxing._free(buffer);

                        if (res && res.text) {
                            setResults(old => {
                                const newResult = `${res?.format}: ${res?.text}`;
                                if (old[0] != newResult) {
                                    navigator.vibrate?.(200);
                                }
                                const filtered = old.filter(r => r !== newResult);
                                return [newResult, ...filtered];
                            });
                        }
                    }
                }
            } catch (e) {
                alert((e as Error).toString());
            }
        }

        requestAnimationFrame(scan);
        // setTimeout(scan, 300);
    }

    return (
        <>
            <button onClick={startCamera} style={{ marginBottom: 10 }}>start</button>
            <div style={{ position: "relative", width: "100%", aspectRatio: "9/16" }}>
                <video ref={videoRef} autoPlay width="100%" style={{ width: "100%", aspectRatio: "9/16" }} playsInline />
                {/* Top overlay */}
                <div style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    height: `${100 * (1 - HEIGHT_RATIO) / 2}%`,
                    background: "rgba(250,250,250,0.8)",
                }} />
                {/* Bottom overlay */}
                <div style={{
                    position: "absolute",
                    bottom: 0,
                    left: 0,
                    width: "100%",
                    height: `${100 * (1 - HEIGHT_RATIO) / 2}%`,
                    background: "rgba(250,250,250,0.8)",
                }} />

                <div style={{
                    position: "absolute",
                    top: "50%",
                    width: "100%",
                    height: `${100 * HEIGHT_RATIO}%`,
                    transform: "translateY(-50%)"
                }} />
            </div>
            <div style={{ marginTop: 20 }}>
                {results.map((item, index) => (
                    <>
                        <div key={index}>{item}</div>
                        <hr />
                    </>
                ))}
            </div>
        </>
    );
}

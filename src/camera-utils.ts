/* eslint-disable @typescript-eslint/no-explicit-any */
export type CameraInfo = { deviceId: string; label?: string };

export type BestCameraResult = {
    deviceId: string;
    suggestedConstraints: MediaTrackConstraints;
    diagnostics: Array<{
        deviceId: string;
        label?: string;
        score: number;
        caps: MediaTrackCapabilities;
        settings: MediaTrackSettings;
    }>;
};

function sleep(ms: number) { return new Promise(res => setTimeout(res, ms)); }

/**
 * Probe each rear camera deviceId, read capabilities/settings, score them, and return the best one.
 * Scoring favors: higher max resolution, zoom range, continuous focus, torch, and "wide/main" labels.
 */
export async function selectBestRearCamera(
    rearCameras: CameraInfo[],
    probeMs = 300
): Promise<BestCameraResult> {
    if (!rearCameras.length) throw new Error("No rear cameras provided.");

    const diagnostics: BestCameraResult["diagnostics"] = [];

    for (const cam of rearCameras) {
        let stream: MediaStream | undefined;
        try {
            stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    deviceId: { exact: cam.deviceId },
                    width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 15 }
                }
            });
            await sleep(probeMs);

            const track = stream.getVideoTracks()[0];
            const caps = track.getCapabilities?.() ?? ({} as MediaTrackCapabilities);
            const settings = track.getSettings?.() ?? ({} as MediaTrackSettings);

            const maxW = (caps as any).width?.max ?? settings.width ?? 0;
            const maxH = (caps as any).height?.max ?? settings.height ?? 0;
            const zoomMax = (caps as any).zoom?.max ?? 0;
            const focusModes: string[] = Array.isArray((caps as any).focusMode) ? (caps as any).focusMode : [];
            const hasContinuousFocus = focusModes.includes("continuous");
            const hasTorch = !!(caps as any).torch;

            const label = cam.label?.toLowerCase() ?? "";
            const isMacro = /macro/.test(label);
            const isDepth = /depth/.test(label);
            const isTele = /tele/.test(label);
            const isWide = /wide|back|rear|main|environment/.test(label);

            let score =
                (maxW * maxH) / 1_000_000 + // ~MP
                zoomMax * 0.5 +
                (hasContinuousFocus ? 2 : 0) +
                (hasTorch ? 0.5 : 0);

            if (isWide) score += 0.5;
            if (isTele) score += 0.3;
            if (isMacro || isDepth) score -= 1.0;

            diagnostics.push({ deviceId: cam.deviceId, label: cam.label, score, caps, settings });
        } catch {
            // ignore failures
        } finally {
            stream?.getTracks().forEach(t => t.stop());
        }
    }

    if (!diagnostics.length) throw new Error("Failed to probe any rear camera.");
    diagnostics.sort((a, b) => b.score - a.score);
    const best = diagnostics[0];

    // const caps = best.caps as any;
    // const targetW = Math.min(1920, caps?.width?.max ?? 1920);
    // const targetH = Math.min(1080, caps?.height?.max ?? 1080);
    // const zoomTarget = caps?.zoom ? Math.min(caps.zoom.max, (caps.zoom.max || 1) * 0.7) : undefined;

    const suggestedConstraints: MediaTrackConstraints = {
        deviceId: { exact: best.deviceId },
        // width: { ideal: targetW }, height: { ideal: targetH }, frameRate: { ideal: 15 },
        // advanced: [
        //     ...(caps?.focusMode ? [{ focusMode: "continuous" as any }] : []) as any,
        //     ...(zoomTarget ? [{ zoom: zoomTarget }] : []),
        // ]
    };

    return { deviceId: best.deviceId, suggestedConstraints, diagnostics };
}

export async function enumerateRearCameras(): Promise<CameraInfo[]> {
    // Ensure permission so labels are populated
    try { await navigator.mediaDevices.getUserMedia({ video: true }); } catch(e) { console.error(e); }
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices
        .filter(d => d.kind === "videoinput")
        .filter(d => /back|rear|environment|wide|tele/i.test(d.label || ""))
        .map(d => ({ deviceId: d.deviceId, label: d.label }));
}

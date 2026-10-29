import { useCallback, useEffect, useRef, useState } from "react";

export type SoundKind =
  | "click"
  | "alert"
  | "success"
  | "error"
  | "transit"
  | "archive"
  | "radio"
  | "flight"
  | "hotel"
  | "glass"
  | "stage"
  | "cold"
  | "hostik";

type Cue = {
  notes: number[];
  duration: number;
  wave: OscillatorType;
  gain: number;
  noise?: number;
};

const cues: Record<SoundKind, Cue> = {
  click: { notes: [620, 820], duration: 0.045, wave: "sine", gain: 0.045 },
  alert: { notes: [330, 220, 330], duration: 0.105, wave: "sawtooth", gain: 0.055, noise: 0.035 },
  success: { notes: [520, 660, 880], duration: 0.11, wave: "triangle", gain: 0.065 },
  error: { notes: [210, 160, 118], duration: 0.12, wave: "sawtooth", gain: 0.065, noise: 0.045 },
  transit: { notes: [880, 660, 440], duration: 0.13, wave: "triangle", gain: 0.055, noise: 0.024 },
  archive: { notes: [260, 390, 520], duration: 0.12, wave: "triangle", gain: 0.052 },
  radio: { notes: [1040, 520, 780], duration: 0.095, wave: "square", gain: 0.04, noise: 0.05 },
  flight: { notes: [740, 620, 520], duration: 0.14, wave: "sine", gain: 0.055, noise: 0.018 },
  hotel: { notes: [420, 525, 630], duration: 0.14, wave: "sine", gain: 0.052 },
  glass: { notes: [1320, 1040, 780], duration: 0.09, wave: "sine", gain: 0.045 },
  stage: { notes: [392, 588, 784], duration: 0.13, wave: "triangle", gain: 0.055 },
  cold: { notes: [900, 1060, 1220], duration: 0.12, wave: "sine", gain: 0.045, noise: 0.012 },
  hostik: { notes: [520, 780, 1040], duration: 0.11, wave: "triangle", gain: 0.06 },
};

const ambientFrequencies: Record<SoundKind, [number, number, number]> = {
  click: [48, 96, 820],
  alert: [44, 71, 560],
  success: [55, 110, 980],
  error: [38, 57, 410],
  transit: [46, 69, 720],
  archive: [52, 78, 640],
  radio: [49, 92, 960],
  flight: [58, 87, 760],
  hotel: [47, 70, 520],
  glass: [62, 124, 1160],
  stage: [55, 82, 690],
  cold: [41, 103, 1280],
  hostik: [54, 108, 880],
};

type AmbientNodes = {
  gain: GainNode;
  sources: AudioScheduledSourceNode[];
  nodes: AudioNode[];
};

type UseGameAudioOptions = {
  ambientEnabled: boolean;
  profile: SoundKind;
};

export function useGameAudio({ ambientEnabled, profile }: UseGameAudioOptions) {
  const [soundOn, setSoundState] = useState(true);
  const [unlocked, setUnlocked] = useState(false);
  const contextRef = useRef<AudioContext | null>(null);
  const masterRef = useRef<GainNode | null>(null);
  const ambientRef = useRef<AmbientNodes | null>(null);

  const ensureContext = useCallback(() => {
    if (typeof window === "undefined") return null;
    if (!contextRef.current) {
      const context = new window.AudioContext({ latencyHint: "interactive" });
      const master = context.createGain();
      master.gain.value = 0.82;
      master.connect(context.destination);
      contextRef.current = context;
      masterRef.current = master;
    }
    void contextRef.current.resume();
    setUnlocked(true);
    return contextRef.current;
  }, []);

  const stopAmbient = useCallback(() => {
    const ambient = ambientRef.current;
    const context = contextRef.current;
    if (!ambient || !context) return;
    ambient.gain.gain.cancelScheduledValues(context.currentTime);
    ambient.gain.gain.setValueAtTime(Math.max(0.0001, ambient.gain.gain.value), context.currentTime);
    ambient.gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.12);
    for (const source of ambient.sources) {
      try { source.stop(context.currentTime + 0.14); } catch { /* source already stopped */ }
    }
    window.setTimeout(() => ambient.nodes.forEach((node) => node.disconnect()), 180);
    ambientRef.current = null;
  }, []);

  const startAmbient = useCallback((kind: SoundKind) => {
    const context = contextRef.current;
    const master = masterRef.current;
    if (!context || !master) return;
    stopAmbient();

    const [base, harmonic, texture] = ambientFrequencies[kind];
    const ambientGain = context.createGain();
    const lowPass = context.createBiquadFilter();
    lowPass.type = "lowpass";
    lowPass.frequency.value = 240;
    lowPass.Q.value = 0.7;
    ambientGain.gain.setValueAtTime(0.0001, context.currentTime);
    ambientGain.gain.exponentialRampToValueAtTime(0.018, context.currentTime + 0.9);
    lowPass.connect(ambientGain);
    ambientGain.connect(master);

    const baseOscillator = context.createOscillator();
    baseOscillator.type = "sine";
    baseOscillator.frequency.value = base;
    baseOscillator.connect(lowPass);

    const harmonicOscillator = context.createOscillator();
    const harmonicGain = context.createGain();
    harmonicOscillator.type = "triangle";
    harmonicOscillator.frequency.value = harmonic;
    harmonicGain.gain.value = 0.16;
    harmonicOscillator.connect(harmonicGain);
    harmonicGain.connect(lowPass);

    const sampleCount = Math.floor(context.sampleRate * 1.5);
    const noiseBuffer = context.createBuffer(1, sampleCount, context.sampleRate);
    const channel = noiseBuffer.getChannelData(0);
    let previous = 0;
    for (let index = 0; index < sampleCount; index += 1) {
      previous = previous * 0.92 + (Math.random() * 2 - 1) * 0.08;
      channel[index] = previous;
    }
    const noise = context.createBufferSource();
    const noiseFilter = context.createBiquadFilter();
    const noiseGain = context.createGain();
    noise.buffer = noiseBuffer;
    noise.loop = true;
    noiseFilter.type = "bandpass";
    noiseFilter.frequency.value = texture;
    noiseFilter.Q.value = 0.55;
    noiseGain.gain.value = 0.11;
    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(ambientGain);

    const lfo = context.createOscillator();
    const lfoGain = context.createGain();
    lfo.type = "sine";
    lfo.frequency.value = 0.09;
    lfoGain.gain.value = 0.004;
    lfo.connect(lfoGain);
    lfoGain.connect(ambientGain.gain);

    const sources: AudioScheduledSourceNode[] = [baseOscillator, harmonicOscillator, noise, lfo];
    sources.forEach((source) => source.start());
    ambientRef.current = {
      gain: ambientGain,
      sources,
      nodes: [baseOscillator, harmonicOscillator, harmonicGain, noise, noiseFilter, noiseGain, lfo, lfoGain, lowPass, ambientGain],
    };
  }, [stopAmbient]);

  const createNoiseBurst = useCallback((context: AudioContext, level: number, startsAt: number, duration: number) => {
    const master = masterRef.current;
    if (!master) return;
    const buffer = context.createBuffer(1, Math.max(1, Math.floor(context.sampleRate * duration)), context.sampleRate);
    const channel = buffer.getChannelData(0);
    for (let index = 0; index < channel.length; index += 1) channel[index] = Math.random() * 2 - 1;
    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const gain = context.createGain();
    source.buffer = buffer;
    filter.type = "bandpass";
    filter.frequency.value = 1150;
    filter.Q.value = 0.65;
    gain.gain.setValueAtTime(0.0001, startsAt);
    gain.gain.exponentialRampToValueAtTime(level, startsAt + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, startsAt + duration);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    source.start(startsAt);
    source.stop(startsAt + duration + 0.02);
  }, []);

  const playSound = useCallback((kind: SoundKind) => {
    if (!soundOn) return;
    try {
      const context = ensureContext();
      const master = masterRef.current;
      if (!context || !master) return;
      const now = context.currentTime;
      const cue = cues[kind];
      cue.notes.forEach((frequency, index) => {
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        const startsAt = now + index * cue.duration * 0.72;
        oscillator.type = cue.wave;
        oscillator.frequency.setValueAtTime(frequency, startsAt);
        oscillator.detune.setValueAtTime(index % 2 === 0 ? -3 : 3, startsAt);
        gain.gain.setValueAtTime(0.0001, startsAt);
        gain.gain.exponentialRampToValueAtTime(cue.gain, startsAt + 0.012);
        gain.gain.exponentialRampToValueAtTime(0.0001, startsAt + cue.duration);
        oscillator.connect(gain);
        gain.connect(master);
        oscillator.start(startsAt);
        oscillator.stop(startsAt + cue.duration + 0.02);
      });
      if (cue.noise) createNoiseBurst(context, cue.noise, now, Math.max(0.08, cue.duration * 1.6));
      if ((kind === "alert" || kind === "error" || kind === "success") && "vibrate" in navigator) {
        navigator.vibrate(kind === "success" ? 35 : kind === "error" ? [45, 30, 45] : 45);
      }
    } catch {
      // Sound is an enhancement; gameplay remains available when Web Audio is blocked.
    }
  }, [createNoiseBurst, ensureContext, soundOn]);

  const setSoundOn = useCallback((enabled: boolean) => {
    setSoundState(enabled);
    if (enabled) ensureContext();
    else stopAmbient();
  }, [ensureContext, stopAmbient]);

  useEffect(() => {
    const stored = window.localStorage.getItem("sled_sound");
    if (stored !== "off") return;
    const timer = window.setTimeout(() => setSoundState(false), 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    window.localStorage.setItem("sled_sound", soundOn ? "on" : "off");
  }, [soundOn]);

  useEffect(() => {
    if (!soundOn || !unlocked || !ambientEnabled) {
      stopAmbient();
      return;
    }
    startAmbient(profile);
    return stopAmbient;
  }, [ambientEnabled, profile, soundOn, startAmbient, stopAmbient, unlocked]);

  useEffect(() => {
    const onVisibilityChange = () => {
      const context = contextRef.current;
      if (!context) return;
      if (document.hidden) void context.suspend();
      else if (soundOn && unlocked) void context.resume();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [soundOn, unlocked]);

  useEffect(() => () => {
    stopAmbient();
    const context = contextRef.current;
    if (context) void context.close();
  }, [stopAmbient]);

  return { soundOn, setSoundOn, playSound };
}

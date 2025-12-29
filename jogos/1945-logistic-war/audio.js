export class SoundManager {
    constructor() {
        this.ctx = null;
        this.musicGain = null;
        this.sfxGain = null;
        this.isMusicPlaying = false;
        this.marchInterval = null;
    }

    init() {
        if (!this.ctx) {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
            this.musicGain = this.ctx.createGain();
            this.sfxGain = this.ctx.createGain();
            this.musicGain.connect(this.ctx.destination);
            this.sfxGain.connect(this.ctx.destination);
            this.musicGain.gain.value = 0.15;
            this.sfxGain.gain.value = 0.3;
        }
        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    createSnare(time) {
        if (!this.ctx || !this.musicGain) return;
        
        const noise = this.ctx.createBufferSource();
        const bufferSize = this.ctx.sampleRate * 0.1;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
        noise.buffer = buffer;

        const noiseFilter = this.ctx.createBiquadFilter();
        noiseFilter.type = 'highpass';
        noiseFilter.frequency.value = 1000;

        const noiseEnvelope = this.ctx.createGain();
        noise.connect(noiseFilter);
        noiseFilter.connect(noiseEnvelope);
        noiseEnvelope.connect(this.musicGain);

        noiseEnvelope.gain.setValueAtTime(0.4, time);
        noiseEnvelope.gain.exponentialRampToValueAtTime(0.01, time + 0.1);
        
        noise.start(time);
        noise.stop(time + 0.1);
    }

    playMorse(type) {
        this.init();
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'square';
        osc.frequency.setValueAtTime(880, this.ctx.currentTime);
        osc.connect(gain);
        gain.connect(this.sfxGain);

        const now = this.ctx.currentTime;
        const dot = 0.06;

        const beep = (startTime, duration) => {
            gain.gain.setValueAtTime(0, startTime);
            gain.gain.linearRampToValueAtTime(0.2, startTime + 0.005);
            gain.gain.setValueAtTime(0.2, startTime + duration - 0.005);
            gain.gain.linearRampToValueAtTime(0, startTime + duration);
        };

        if (type === 'fusion') {
            beep(now, dot);
            beep(now + dot * 2, dot * 3);
            osc.start(now);
            osc.stop(now + dot * 6);
        } else if (type === 'start') {
            beep(now, dot * 3);
            beep(now + dot * 4, dot * 3);
            osc.start(now);
            osc.stop(now + dot * 8);
        } else {
            beep(now, dot);
            osc.start(now);
            osc.stop(now + dot * 2);
        }
    }

    startBGM() {
        this.init();
        if (this.isMusicPlaying) return;
        this.isMusicPlaying = true;

        let beat = 0;
        const tempo = 450; 

        this.marchInterval = window.setInterval(() => {
            const now = this.ctx.currentTime;
            if (beat === 0 || beat === 1) {
                this.createSnare(now);
            } else if (beat === 2) {
                this.createSnare(now);
                this.createSnare(now + 0.12);
            } else if (beat === 3) {
                this.createSnare(now);
            }
            beat = (beat + 1) % 4;
        }, tempo);
    }

    toggleMusic() {
        this.init();
        if (this.isMusicPlaying) {
            if (this.marchInterval) clearInterval(this.marchInterval);
            this.isMusicPlaying = false;
            if (this.musicGain) this.musicGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1);
        } else {
            if (this.musicGain) this.musicGain.gain.setTargetAtTime(0.15, this.ctx.currentTime, 0.1);
            this.startBGM();
        }
        return this.isMusicPlaying;
    }
}

export class SoundManager {
    constructor() {
        this.ctx = null;
        this.mainGain = null;
        this.musicInterval = null;
        this.currentVolume = 0.5;
    }

    async init() {
        if (!this.ctx) {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
            this.mainGain = this.ctx.createGain();
            this.mainGain.gain.value = this.currentVolume;
            this.mainGain.connect(this.ctx.destination);
        }
        if (this.ctx.state === 'suspended') await this.ctx.resume();
    }

    playPop(freq = 600) {
        if (!this.ctx || !this.mainGain) return;
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(100, this.ctx.currentTime + 0.1);
        g.gain.setValueAtTime(0.3 * this.currentVolume, this.ctx.currentTime);
        g.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.1);
        osc.connect(g); g.connect(this.mainGain);
        osc.start(); osc.stop(this.ctx.currentTime + 0.1);
    }

    playCorrectSyllable(step) {
        if (!this.ctx || !this.mainGain) return;
        const time = this.ctx.currentTime;
        const baseFreq = 523.25; 
        const freq = baseFreq + (step * 150);
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, time);
        g.gain.setValueAtTime(0.2 * this.currentVolume, time);
        g.gain.exponentialRampToValueAtTime(0.001, time + 0.4);
        osc.connect(g); g.connect(this.mainGain);
        osc.start(time); osc.stop(time + 0.4);
    }

    playIncorrectSyllable() {
        if (!this.ctx || !this.mainGain) return;
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(100, this.ctx.currentTime);
        osc.frequency.linearRampToValueAtTime(50, this.ctx.currentTime + 0.2);
        g.gain.setValueAtTime(0.1 * this.currentVolume, this.ctx.currentTime);
        g.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.2);
        osc.connect(g); g.connect(this.mainGain);
        osc.start(); osc.stop(this.ctx.currentTime + 0.2);
    }

    playExplode() {
        if (!this.ctx || !this.mainGain) return;
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(80, this.ctx.currentTime);
        g.gain.setValueAtTime(0.3 * this.currentVolume, this.ctx.currentTime);
        g.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.5);
        osc.connect(g); g.connect(this.mainGain);
        osc.start(); osc.stop(this.ctx.currentTime + 0.5);
    }

    startMusic() {
        if (!this.ctx || !this.mainGain || this.musicInterval) return;
        let step = 0;
        const tempo = 0.2;
        const scale = [261.63, 293.66, 329.63, 392.00, 440.00];
        const playNote = () => {
            if (!this.ctx || !this.mainGain) return;
            const time = this.ctx.currentTime;
            const osc = this.ctx.createOscillator();
            const g = this.ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(scale[step % scale.length], time);
            g.gain.setValueAtTime(0.05, time);
            g.gain.exponentialRampToValueAtTime(0.001, time + tempo);
            osc.connect(g); g.connect(this.mainGain);
            osc.start(time); osc.stop(time + tempo);
            step++;
            this.musicInterval = setTimeout(playNote, tempo * 1000);
        };
        playNote();
    }

    stopMusic() {
        if (this.musicInterval) {
            clearTimeout(this.musicInterval);
            this.musicInterval = null;
        }
    }
}

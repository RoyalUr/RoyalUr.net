//
// This file adds particle and firework simulation.
//

import {clamp, getTime, isAudioElementPlaying, min, rand, rgba} from "@/common/utils";
import {Vec2} from "@/common/vectors";
import {AudioSystem} from "@/common/resources/audio_system";


export class ParticleSystem {

    readonly radiusRatio: number;
    readonly minRadiusPixels: number;
    readonly maxRadiusPixels: number;
    readonly gravityRatio: number;

    readonly birthTime: number[] = [];
    readonly lifetime: number[] = [];
    readonly locs: Vec2[] = [];
    readonly vels: Vec2[] = [];
    readonly accels: Vec2[] = [];
    readonly rgbs: [number, number, number][] = [];

    constructor(radiusRatio: number=2/2560,
                minRadiusPixels: number=0.8,
                maxRadiusPixels: number=1.5,
                gravityRatio: number=200/2560) {

        this.radiusRatio = radiusRatio;
        this.minRadiusPixels = minRadiusPixels;
        this.maxRadiusPixels = maxRadiusPixels;
        this.gravityRatio = gravityRatio;
    }

    add(lifetime: number, loc: Vec2, vel: Vec2, acc: Vec2,
            rgb: [number, number, number]) {

        this.birthTime.push(getTime());
        this.lifetime.push(lifetime);
        this.locs.push(loc);
        this.vels.push(vel);
        this.accels.push(acc);
        this.rgbs.push(rgb);
    }

    remove(index: number) {
        this.birthTime.splice(index, 1);
        this.lifetime.splice(index, 1);
        this.locs.splice(index, 1);
        this.vels.splice(index, 1);
        this.accels.splice(index, 1);
        this.rgbs.splice(index, 1);
    }

    createExplosion(
            particleCount: number,
            loc: Vec2,
            speed: number,
            lifetime: number,
            rgb: [number, number, number],
            sphere: boolean, gravity: boolean) {

        for (let index=0; index < particleCount; ++index) {
            const angle = (index + Math.random()) * 360 / particleCount,
                  vel = Vec2.polar(speed * (sphere ? Math.sqrt(Math.random()) : Math.random()), angle),
                  acc = Vec2.create(0, (gravity ? this.gravityRatio * width : 0));

            this.add(
                lifetime * (0.6 * rand() + 0.7) ,
                loc, vel, acc,
                rgb
            );
        }
    }

    removeDead() {
        const time = getTime();

        let index = this.birthTime.length;
        while (index > 0) {
            index -= 1;

            const age = (time - this.birthTime[index]) / this.lifetime[index];
            if (age >= 1) {
                this.remove(index);
            }
        }
    }

    drawParticles(ctx: CanvasRenderingContext2D) {
        const time = getTime();

        for (let index = 0; index < this.birthTime.length; ++index) {
            const ageSecs = (time - this.birthTime[index]),
                  age = ageSecs / this.lifetime[index],
                  pos = Vec2.quadratic(this.accels[index], this.vels[index], this.locs[index], ageSecs),
                  rgb = this.rgbs[index],
                  radius = clamp(this.radiusRatio * width, this.minRadiusPixels, this.maxRadiusPixels);

            if (age > 1)
                continue;

            const alpha = (0.25 * Math.cos(12 * Math.PI * age * age * age * age) + 0.75) * Math.sqrt(1 - age);
            ctx.fillStyle = rgba(rgb[0], rgb[1], rgb[2], alpha);
            ctx.fillRect(pos.x - radius, pos.y - radius, radius * 2, radius * 2);
        }
    }
}



//
// FIREWORKS
//

class Firework {

    readonly createTime: number;
    readonly lifetime: number;
    readonly loc: Vec2;
    readonly move: Vec2;
    readonly rgb: [number, number, number];
    readonly rocketSound;

    constructor(start: Vec2, end: Vec2, speed: number,
                rgb: [number, number, number],
                rocketSound: HTMLAudioElement) {

        const move = end.sub(start);

        this.createTime = getTime();
        this.lifetime = move.len() / speed;
        this.loc = start;
        this.move = move;
        this.rgb = rgb;
        this.rocketSound = rocketSound;
    }

    calculateAge(time: number): number {
        return min(1, (time - this.createTime) / this.lifetime);
    }

    calculateLoc(age: number): Vec2 {
        return this.loc.add(this.move.mul(age));
    }

    stopRocketSound() {
        if (!this.rocketSound || !isAudioElementPlaying(this.rocketSound))
            return;

        this.rocketSound.pause();
        this.rocketSound.currentTime = 0;
    }
}

class FireworkSystem {

    static readonly explodeParticleSpeed = 120 / 2560;
    static readonly trailParticleSpeed = 120 / 2560;

    readonly audioSystem: AudioSystem;
    readonly particles: ParticleSystem;
    readonly fireworks: Firework[] = [];

    lastSimTime: number;

    constructor(audioSystem: AudioSystem, particles: ParticleSystem) {
        this.audioSystem = audioSystem;
        this.particles = particles;
        this.lastSimTime = getTime();
    }

    create(start: Vec2, end: Vec2, speed: number, rgb: [number, number, number]) {
        this.fireworks.push(new Firework(
            start, end, speed, rgb,
            this.audioSystem.playSound("firework_rocket")
        ));
    }

    simulate() {
        const time = getTime();

        let index = this.fireworks.length;
        while (index > 0) {
            index -= 1;

            const firework = this.fireworks[index],
                  age = firework.calculateAge(time),
                  lastAge = firework.calculateAge(this.lastSimTime),
                  loc = firework.calculateLoc(age),
                  movement = loc.sub(firework.calculateLoc(lastAge)).len();

            // Check if the firework should explode!
            if (age >= 1) {
                this.audioSystem.playSound("firework_explode");
                firework.stopRocketSound();
                this.particles.createExplosion(
                    360, loc, FireworkSystem.explodeParticleSpeed * width,
                    1, firework.rgb, true, true
                );
                this.fireworks.splice(index, 1);
                continue;
            }

            // Draw the firework trails.
            for (let move = 1; move <= movement; ++move) {
                const intermediateAge = age + (age - lastAge) * (move / movement);
                this.particles.createExplosion(
                    2, firework.calculateLoc(intermediateAge),
                    FireworkSystem.trailParticleSpeed * width,
                    0.5, [255, 255, 255], false, false
                );
            }
        }
        this.lastSimTime = time;
    }
}
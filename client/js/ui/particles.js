//
// This file adds particle and firework simulation.
//

const PARTICLE_RADIUS = 2 / 2560,
      MIN_PARTICLE_RADIUS = 0.8,
      MAX_PARTICLE_RADIUS = 1.5,
      PARTICLE_GRAVITY = 200 / 2560;

const particles = {
    birthTime: [],
    lifetime: [],
    x: [],
    y: [],
    vx: [],
    vy: [],
    ax: [],
    ay: [],
    r: [],
    g: [],
    b: []
};

function addParticle(lifetime, x, y, vx, vy, ax, ay, r, g, b) {
    particles.birthTime.push(getTime());
    particles.lifetime.push(lifetime);
    particles.x.push(x);
    particles.y.push(y);
    particles.vx.push(vx);
    particles.vy.push(vy);
    particles.ax.push(ax);
    particles.ay.push(ay);
    particles.r.push(r);
    particles.g.push(g);
    particles.b.push(b);
}

function createParticleExplosion(particleCount, x, y, speed, lifetime, red, green, blue, sphere, gravity) {
    for (let index=0; index < particleCount; ++index) {
        const angle = (index + Math.random()) * 360 / particleCount,
            vl = speed * (sphere ? Math.sqrt(Math.random()) : Math.random()),
            vx = Math.cos(angle) * vl,
            vy = Math.sin(angle) * vl;

        addParticle(
            lifetime * (0.6 * rand() + 0.7) ,
            x, y,
            vx, vy,
            0, (gravity ? PARTICLE_GRAVITY * width : 0),
            red, green, blue
        );
    }
}

function removeParticle(index) {
    particles.birthTime.splice(index, 1);
    particles.lifetime.splice(index, 1);
    particles.x.splice(index, 1);
    particles.y.splice(index, 1);
    particles.vx.splice(index, 1);
    particles.vy.splice(index, 1);
    particles.ax.splice(index, 1);
    particles.ay.splice(index, 1);
    particles.r.splice(index, 1);
    particles.g.splice(index, 1);
    particles.b.splice(index, 1);
}

function removeDeadParticles() {
    const time = getTime();

    let index = particles.birthTime.length;
    while (index > 0) {
        index -= 1;

        const age = (time - particles.birthTime[index]) / particles.lifetime[index];
        if (age >= 1) {
            removeParticle(index);
        }
    }
}

function drawParticles(ctx) {
    const time = getTime();

    for (let index = 0; index < particles.birthTime.length; ++index) {
        const ageSecs = (time - particles.birthTime[index]),
              age = ageSecs / particles.lifetime[index],
              x = particles.x[index] + particles.vx[index] * ageSecs + 0.5 * particles.ax[index] * ageSecs * ageSecs,
              y = particles.y[index] + particles.vy[index] * ageSecs + 0.5 * particles.ay[index] * ageSecs * ageSecs,
              red = particles.r[index],
              green = particles.g[index],
              blue = particles.b[index],
              radius = clamp(PARTICLE_RADIUS * width, MIN_PARTICLE_RADIUS, MAX_PARTICLE_RADIUS);

        if (age > 1)
            continue;

        const alpha = (0.25 * Math.cos(12 * Math.PI * age * age * age * age) + 0.75) * Math.sqrt(1 - age);

        ctx.fillStyle = rgba(red, green, blue, alpha);
        ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
    }
}



//
// FIREWORKS
//

const FIREWORK_EXPLODE_PARTICLE_SPEED = 120 / 2560,
      FIREWORK_TRAIL_PARTICLE_SPEED = 30 / 2560;

let fireworksLastSimTime = 0,
    fireworks = [];

function createFirework(x1, y1, x2, y2, speed, r, g, b) {
    const dx = x2 - x1,
        dy = y2 - y1,
        dl = Math.sqrt(dx*dx + dy*dy);

    fireworks.push({
        createTime: getTime(),
        lifetime: dl / speed,
        x: x1,
        y: y1,
        dx: x2 - x1,
        dy: y2 - y1,
        r: r,
        g: g,
        b: b,
        rocket_sound: audioSystem.playSound("firework_rocket")
    });
}

function removeFirework(index) {
    fireworks.splice(index, 1);
}

function simulateFireworks() {
    const time = getTime();

    let index = fireworks.length;
    while (index > 0) {
        index -= 1;

        const firework = fireworks[index],
            age = (time - firework.createTime) / firework.lifetime,
            effectiveAge = min(1, age),
            lastAge = max(0, (fireworksLastSimTime - firework.createTime) / firework.lifetime),
            x = firework.x + effectiveAge * firework.dx,
            y = firework.y + effectiveAge * firework.dy,
            dx = (effectiveAge - lastAge) * firework.dx,
            dy = (effectiveAge - lastAge) * firework.dy,
            dl = Math.sqrt(dx*dx + dy*dy);

        if (age > 1) {
            audioSystem.playSound("firework_explode");
            if (firework.rocket_sound && isAudioElementPlaying(firework.rocket_sound)) {
                firework.rocket_sound.pause();
                firework.rocket_sound.currentTime = 0;
            }

            createParticleExplosion(
                360, x, y,
                FIREWORK_EXPLODE_PARTICLE_SPEED * width,
                1,
                firework.r, firework.g, firework.b,
                true, true
            );
            removeFirework(index);
            continue;
        }

        for (let index = dl - 1; index >= 0; --index) {
            const prop = index / dl;
            createParticleExplosion(
                2, x - prop * dx, y - prop * dy,
                FIREWORK_TRAIL_PARTICLE_SPEED * width,
                0.5,
                255, 255, 255,
                false, false
            );
        }
    }

    fireworksLastSimTime = time;
}
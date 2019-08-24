//
// PARTICLES
//

const MAX_DT = 0.1,
      PARTICLE_RADIUS = 2 / 2560,
      MIN_PARTICLE_RADIUS = 0.8,
      MAX_PARTICLE_RADIUS = 1.5,
      PARTICLE_GRAVITY = 200 / 2560;

let particlesLastSimTime = 0;
const particleBirthTime = [],
      particleLifetime = [],
      particleX = [],
      particleY = [],
      particleVX = [],
      particleVY = [],
      particleAX = [],
      particleAY = [],
      particleR = [],
      particleG = [],
      particleB = [];

function addParticle(lifetime, x, y, vx, vy, ax, ay, r, g, b) {
    particleBirthTime.push(getTime());
    particleLifetime.push(lifetime);
    particleX.push(x);
    particleY.push(y);
    particleVX.push(vx);
    particleVY.push(vy);
    particleAX.push(ax);
    particleAY.push(ay);
    particleR.push(r);
    particleG.push(g);
    particleB.push(b);
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
    particleBirthTime.splice(index, 1);
    particleLifetime.splice(index, 1);
    particleX.splice(index, 1);
    particleY.splice(index, 1);
    particleVX.splice(index, 1);
    particleVY.splice(index, 1);
    particleAX.splice(index, 1);
    particleAY.splice(index, 1);
    particleR.splice(index, 1);
    particleG.splice(index, 1);
    particleB.splice(index, 1);
}

function simulateParticles() {
    const time = getTime(),
        dt = min(MAX_DT, time - particlesLastSimTime);

    particlesLastSimTime = time;

    let removed = 0;

    let index = particleBirthTime.length;
    while (index > 0) {
        index -= 1;

        const age = (time - particleBirthTime[index]) / particleLifetime[index];
        if (age >= 1) {
            removed += 1;
            removeParticle(index);
            continue;
        }

        particleX[index] = particleX[index] + dt * particleVX[index];
        particleY[index] = particleY[index] + dt * particleVY[index];
        particleVX[index] =  particleVX[index] + dt * particleAX[index];
        particleVY[index] = particleVY[index] + dt * particleAY[index];
    }
}

function drawParticles(ctx) {
    const time = getTime();

    for (let index = 0; index < particleBirthTime.length; ++index) {
        const age = (time - particleBirthTime[index]) / particleLifetime[index],
            x = particleX[index],
            y = particleY[index],
            red = particleR[index],
            green = particleG[index],
            blue = particleB[index],
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
        rocket_sound: playSound("firework_rocket")
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
            playSound("firework_explode");
            if (firework.rocket_sound && isAudioPlaying(firework.rocket_sound)) {
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
// galaxy.js - Three.js 3D Background & Transition

let scene, camera, renderer, stars, earth;
let isAnimating = true;
let isFlying = false;

function initGalaxy() {
  const canvas = document.getElementById('bg-canvas');
  if (!canvas || typeof THREE === 'undefined') return;

  scene = new THREE.Scene();
  // Add some fog to fade out distant stars
  scene.fog = new THREE.FogExp2(0x000000, 0.001);

  camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 1, 2000);
  camera.position.z = 600;

  renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  // --- 1. STARS / GALAXY PARTICLES ---
  const starGeo = new THREE.BufferGeometry();
  const starCount = 8000;
  const posArray = new Float32Array(starCount * 3);
  const colorArray = new Float32Array(starCount * 3);

  const starColors = [
    new THREE.Color(0xa366ff), // bright violet
    new THREE.Color(0xc299ff), // soft lavender
    new THREE.Color(0x8a4fff), // blueish purple
    new THREE.Color(0xff4db8)  // magenta
  ];

  for(let i=0; i < starCount * 3; i+=3) {
    // Distribute stars in a wide disc/sphere
    const r = 800 * Math.cbrt(Math.random());
    const theta = Math.random() * 2 * Math.PI;
    const phi = Math.acos(2 * Math.random() - 1);
    
    // Flatten a bit to look like a galaxy disc
    posArray[i] = r * Math.sin(phi) * Math.cos(theta);
    posArray[i+1] = r * Math.sin(phi) * Math.sin(theta) * 0.3; // flatten Y
    posArray[i+2] = r * Math.cos(phi);

    // Pick random color
    const c = starColors[Math.floor(Math.random() * starColors.length)];
    colorArray[i] = c.r;
    colorArray[i+1] = c.g;
    colorArray[i+2] = c.b;
  }

  starGeo.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
  starGeo.setAttribute('color', new THREE.BufferAttribute(colorArray, 3));

  // Load a simple circular sprite for stars to make them soft (optional, using basic Points for now)
  const starMat = new THREE.PointsMaterial({
    size: 2.5,
    vertexColors: true,
    transparent: true,
    opacity: 0.8,
    blending: THREE.AdditiveBlending
  });

  stars = new THREE.Points(starGeo, starMat);
  scene.add(stars);

  // --- 2. THE STARTING EARTH ---
  // A glowing wireframe sphere representing Earth, placed far behind the camera initially
  const earthGeo = new THREE.SphereGeometry(120, 32, 32);
  const earthMat = new THREE.MeshBasicMaterial({
    color: 0x8a4fff,
    wireframe: true,
    transparent: true,
    opacity: 0.0 // hidden initially
  });
  earth = new THREE.Mesh(earthGeo, earthMat);
  
  // Place earth far away, camera will fly towards it
  earth.position.set(0, 0, -1500); 
  scene.add(earth);

  // Resize handler
  window.addEventListener('resize', onWindowResize, false);

  // Start loop
  animate();
}

function onWindowResize() {
  if (!camera || !renderer) return;
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
  if (!isAnimating) return;
  requestAnimationFrame(animate);

  // Slowly rotate the galaxy
  if (stars && !isFlying) {
    stars.rotation.y += 0.0005;
    stars.rotation.z += 0.0002;
  }

  // Earth rotation
  if (earth) {
    earth.rotation.y += 0.005;
  }

  renderer.render(scene, camera);
}

// Global function to trigger the transition
window.flyToEarth = function(callback) {
  if (isFlying) return;
  isFlying = true;

  // Make earth visible
  earth.material.opacity = 0;
  
  // We will animate the camera from z=600 to z=-1100 (close to earth at -1500)
  const startZ = camera.position.z;
  const targetZ = -1200; // stopping just in front of Earth (radius 120, center -1500)
  const duration = 2500; // ms
  const startTime = performance.now();

  function flyAnimation(time) {
    const elapsed = time - startTime;
    let t = Math.min(elapsed / duration, 1.0);
    
    // Ease in out cubic
    const ease = t < .5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1;

    // Move camera forward
    camera.position.z = startZ + (targetZ - startZ) * ease;
    
    // Rotate camera slightly for a cool space maneuver effect
    camera.rotation.z = Math.sin(ease * Math.PI) * 0.2;

    // Fade in earth
    earth.material.opacity = ease;

    // Speed up stars passing by
    if (stars) {
      stars.position.z += 5 * ease;
    }

    if (t < 1.0) {
      requestAnimationFrame(flyAnimation);
    } else {
      // Transition complete, create a white flash overlay via DOM
      createFlash(callback);
    }
  }

  requestAnimationFrame(flyAnimation);
};

function createFlash(callback) {
  const flash = document.createElement('div');
  flash.style.position = 'fixed';
  flash.style.inset = '0';
  flash.style.backgroundColor = '#1b0d3a';
  flash.style.zIndex = '9999';
  flash.style.opacity = '0';
  flash.style.transition = 'opacity 0.2s ease-out';
  flash.style.pointerEvents = 'none';
  document.body.appendChild(flash);

  // Trigger flash
  setTimeout(() => {
    flash.style.opacity = '1';
    
    // In the middle of the flash, stop 3D and fire callback
    setTimeout(() => {
      isAnimating = false; // Stop rendering to save battery
      const canvas = document.getElementById('bg-canvas');
      if (canvas) canvas.style.display = 'none'; // hide canvas
      
      if (callback) callback();

      // Fade out flash
      flash.style.transition = 'opacity 1s ease-in';
      flash.style.opacity = '0';
      setTimeout(() => flash.remove(), 1000);

    }, 200);

  }, 50);
}

// Initialize on load
window.addEventListener('load', initGalaxy);

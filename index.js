import * as THREE from 'three';
import metaversefile from 'metaversefile';
const {useApp, useFrame, useActivate, useWear, useUse, useLocalPlayer, usePhysics, useScene, useCamera, getNextInstanceId, getAppByPhysicsId, useWorld, useCameraManager, useDefaultModules, useCleanup, useSound} = metaversefile;

const baseUrl = import.meta.url.replace(/(\/)[^\/\\]*$/, '$1');

const localVector = new THREE.Vector3();
const localVector2 = new THREE.Vector3();
const localVector3 = new THREE.Vector3();
const localVector4 = new THREE.Vector3();
const localVector5 = new THREE.Vector3();
const localVector6 = new THREE.Vector3();
const localQuaternion = new THREE.Quaternion();
const localQuaternion2 = new THREE.Quaternion();
const localEuler = new THREE.Euler();
const localMatrix = new THREE.Matrix4();

const zeroVector = new THREE.Vector3(0, 0, 0);
const upVector = new THREE.Vector3(0, 1, 0);
const yN90Quaternion = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -Math.PI/2);
const y180Quaternion = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI);
const smallUpQuaternion = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), 0.03*Math.PI);
const gravity = new THREE.Vector3(0, -3.8, 0);
const emptyArray = [];
const fnEmptyArray = () => emptyArray;
const arrowLength = 0.3;
const bowUseTime = 850;
const bowStringTime = 500;

const _setQuaternionFromVelocity = (quaternion, velocity) => quaternion.setFromRotationMatrix(
  localMatrix.lookAt(
    zeroVector,
    velocity,
    upVector
  )
);

export default e => {
  const app = useApp();
  app.name = 'rpg';

  const sounds = useSound();
  const soundFiles = sounds.getSoundFiles();
  const drawSoundIndex=soundFiles.combat.map(sound => sound.name).indexOf('combat/bow_draw.wav');
  const releaseSoundIndex=soundFiles.combat.map(sound => sound.name).indexOf('combat/Weapon_Whoosh_Low_2.wav');
  const hitSoundIndex=soundFiles.sonicBoom.map(sound => sound.name).indexOf('sonicBoom/SonicBoomBoom.wav');

  const physics = usePhysics();
  const scene = useScene();
  const camera = useCamera();
  const cameraManager = useCameraManager();

  let bowApp = null;
  const _setBowApp = app => {
    bowApp = app;
  };
  let pendingArrowApp = null;
  let shootingArrowApp = null;
  let arrowApps = [];
  e.waitUntil((async () => {
    {
      let u2 = `${baseUrl}rocket-launcher.glb`;
      if (/^https?:/.test(u2)) {
        u2 = '/@proxy/' + u2;
      }
      const m = await metaversefile.import(u2);
      const bowApp = metaversefile.createApp({
        name: u2,
      });
      bowApp.position.copy(app.position);
      bowApp.quaternion.copy(app.quaternion);
      bowApp.scale.copy(app.scale);
      bowApp.updateMatrixWorld();
      bowApp.name = 'rpg';
      bowApp.getPhysicsObjectsOriginal = bowApp.getPhysicsObjects;
      bowApp.getPhysicsObjects = fnEmptyArray;

      const components = [
        {
          "key": "instanceId",
          "value": getNextInstanceId(),
        },
        {
          "key": "contentId",
          "value": u2,
        },
        {
          "key": "physics",
          "value": true,
        },
        {
          "key": "wear",
          "value": {
            "boneAttachment": "leftHand",
            "position": [-0.04, -0.03, -0.01],
            "quaternion": [0.5, -0.5, -0.5, 0.5],
            "scale": [1, 1, 1]
          }
        },
        {
          "key": "aim",
          "value": {}
        },
        {
          "key": "use",
          "value": {
            "ik": "pistol"
          }
        }
      ];
      
      for (const {key, value} of components) {
        bowApp.setComponent(key, value);
      }
      await bowApp.addModule(m);
      scene.add(bowApp);

      const arrowTemplateMeshOriginal = bowApp.getObjectByName('rocket');
      const arrowTemplateMesh = arrowTemplateMeshOriginal.clone();
      arrowTemplateMeshOriginal.visible = false;

      const _createArrowApp = () => {
        const arrowApp = metaversefile.createApp({
          name: 'arrow',
        });

        const arrowMesh = arrowTemplateMesh.clone();
        arrowMesh.frustumCulled = false;
        arrowApp.add(arrowMesh);

        const tip = new THREE.Object3D();
        tip.position.set(0, 0, -arrowLength/2);
        arrowApp.add(tip);
        arrowApp.tip = tip;

        arrowApp.velocity = new THREE.Vector3();
        
        arrowApp.updatePhysics = (timestamp, timeDiff) => {
          const timeDiffS = timeDiff / 1000;

          const moveDistance = arrowApp.velocity.length() * timeDiffS;
          arrowApp.tip.matrixWorld.decompose(localVector, localQuaternion, localVector2);
          const collision = physics.raycast(
            localVector,
            localQuaternion
          );
          const collided = collision && collision.distance <= moveDistance;

          _setQuaternionFromVelocity(arrowApp.quaternion, arrowApp.velocity);
          const normalizedVelocity = localVector3.copy(arrowApp.velocity)
            .normalize();

          let moveFactor;
          if (collided) {
            {
              sounds.playSound(soundFiles.sonicBoom[hitSoundIndex]);
              moveFactor = collision.distance;
              arrowApp.velocity.setScalar(0);
            }
            {
              const collisionId = collision.objectId;
              const object = getAppByPhysicsId(collisionId);
              if (object) {
                const damage = 0;
                const hitDirection = localVector4.set(0, 0, -1)
                  .applyQuaternion(arrowApp.quaternion);
                const hitPosition = localVector5.fromArray(collision.point);

                localEuler.setFromQuaternion(camera.quaternion, 'YXZ');
                localEuler.x = 0;
                localEuler.z = 0;
                const hitQuaternion = localQuaternion.setFromEuler(localEuler);

                // const willDie = object.willDieFrom(damage);
                object.hit(damage, {
                  collisionId,
                  hitPosition,
                  hitQuaternion,
                  hitDirection,
                  // willDie,
                });

                let physicsExplosion = new THREE.Vector3();
                physicsExplosion.copy(hitPosition);

                //let wall = useWorld().appManager.apps.find(app => app.name === "wall");

                const worldApps = useWorld().appManager.apps;

                worldApps.forEach(worldApp => {
                  const physicsObjects = worldApp.getPhysicsObjects();
                  if(physicsObjects[0]) {
                    let phyObj = physicsObjects[0];
                    let dist = phyObj.position.distanceTo(physicsExplosion);

                    let dir = new THREE.Vector3();
                    dir.subVectors(phyObj.position, physicsExplosion).normalize();

                    if(dist < 3) {
                      physics.addForceAtPos(phyObj, dir.multiplyScalar(dist*20), physicsExplosion);
                    }
                  }
                });
              }
            }
          } else {
            moveFactor = moveDistance;
            arrowApp.velocity.add(
              localVector6.copy(gravity)
                .multiplyScalar(timeDiffS)
            );
          }
          arrowApp.position.add(
            localVector6.copy(normalizedVelocity)
              .multiplyScalar(moveFactor)
          );

          arrowApp.updateMatrixWorld();

          return !collided;
        };

        return arrowApp;
      };

      bowApp.use = e => {
        // console.log('got use', e);
        pendingArrowApp = _createArrowApp();
        scene.add(pendingArrowApp);

        arrowTemplateMeshOriginal.visible = true;
      };
      bowApp.unuse = e => {
        arrowTemplateMeshOriginal.visible = false;

        const localPlayer = useLocalPlayer();
        const timestamp = performance.now();

        const timeDiff = timestamp - localPlayer.characterPhysics.lastBowUseStartTime;
        if (timeDiff >= bowUseTime) {
          pendingArrowApp.velocity.set(0, 0, 50)
            .applyQuaternion(
              pendingArrowApp.quaternion
            );
        } else {
          pendingArrowApp.velocity.setScalar(0);
        }

        cameraManager.addShake( localPlayer.position, 0.05, 60, 100);

        shootingArrowApp = pendingArrowApp;
        pendingArrowApp = null;
      };

      _setBowApp(bowApp);
    }
  })());
  
  app.getPhysicsObjects = () => {
    return bowApp ? bowApp.getPhysicsObjectsOriginal() : [];
  };
  
  useActivate(() => {
    const localPlayer = useLocalPlayer();
    localPlayer.wear(app);
  });
  
  let wearing = false;
  useWear(e => {
    const {wear, player} = e;
    if (bowApp) {
      /* bowApp.position.copy(app.position);
      bowApp.scale.copy(app.scale);
      bowApp.updateMatrixWorld(); */
      
      bowApp.dispatchEvent({
        type: 'wearupdate',
        player,
        wear,
      });
    }
    wearing = wear;
  });


  let oldBowDrawSound=null; 
  let bowUseSw=false;
  let bowStartTime=0;
  let bowSoundPlay=false;
  useUse(e => {
    if (bowApp) {
      if (e.use) {
        bowApp.use(e);
        bowUseSw=true;
      } else {
        bowApp.unuse(e);
        if(oldBowDrawSound){
          oldBowDrawSound.stop();
        }
        sounds.playSound(soundFiles.combat[releaseSoundIndex]);
        bowSoundPlay=false;
        bowStartTime=0;
        bowUseSw=false;
      }
    }
  });

  useFrame(({timestamp, timeDiff}) => {

    if(bowStartTime===0 && bowUseSw){
      bowStartTime=timestamp;
    }

    const localPlayer = useLocalPlayer();
    
    if (!wearing) {
      if (bowApp) {
        bowApp.position.copy(app.position);
        bowApp.quaternion.copy(app.quaternion);
        bowApp.updateMatrixWorld();
      }
    } else {
      if (bowApp) {
        app.position.copy(bowApp.position);
        app.quaternion.copy(bowApp.quaternion);
        app.updateMatrixWorld();
      }
    }

    {
      const timeDiff = timestamp - localPlayer.characterPhysics.lastPistolUseStartTime;

      const arrowApp = pendingArrowApp;
      if (arrowApp) {
        arrowApp.position.copy(bowApp.position);
        arrowApp.quaternion.copy(bowApp.quaternion);
        arrowApp.updateMatrixWorld();
        arrowApp.visible = false;
      }
    }
    if (shootingArrowApp) {
      shootingArrowApp.visible = true;
      arrowApps.push(shootingArrowApp);
      shootingArrowApp = null;
    }
    if (arrowApps.length > 0) {
      arrowApps = arrowApps.filter(arrowApp => arrowApp.updatePhysics(timestamp, timeDiff));
    }
  });
  
  useCleanup(() => {
    scene.remove(bowApp);
  });

  return app;
};

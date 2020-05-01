import * as THREE from "three";


export function calculateMaxSplitDistances(maxSplitDistances, splitCount, splitLambda, near, far) {
    maxSplitDistances[0] = near;

    for (let i = 1; i < splitCount + 1; i++) {
        let f = i / (splitCount + 1);
        let l = near * Math.pow(far / near, f);
        let u = near + (far - near) * f;
        maxSplitDistances[i] = l * splitLambda + u * (1 - splitLambda);
    }
    return maxSplitDistances
}

export function calculateCameraFrustumCorners(camera) {
    let NDCCorners = [
        [-1,-1,-1], [1,-1,-1], [-1,1,-1], [1,1,-1],
        [-1,-1, 1], [1,-1, 1], [-1,1, 1], [1,1, 1]];

    let worldCorners = [];
    for (let i = 0; i < NDCCorners.length; ++i) {
        let NDCVector = new THREE.Vector3(...NDCCorners[i]);
        let vCam = NDCVector.unproject(camera);
        worldCorners.push(vCam);
    }

    return worldCorners.map(function (p) {
        return new THREE.Vector3(p.x, p.y, p.z);
    });
}

function calculateBoundingBox(points) {
    let minX = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    let minZ = Number.POSITIVE_INFINITY;
    let maxZ = Number.NEGATIVE_INFINITY;
    for (const point of points) {
        minX = Math.min(point.x, minX);
        maxX = Math.max(point.x, maxX);
        minY = Math.min(point.y, minY);
        maxY = Math.max(point.y, maxY);
        minZ = Math.min(point.z, minZ);
        maxZ = Math.max(point.z, maxZ);
    }

    return {minX: minX, minY: minY, minZ: minZ, maxX: maxX, maxY: maxY, maxZ: maxZ};
}

export function getOrthographicCameraForPerspectiveCamera(camera) {
    const frustumCorners = calculateCameraFrustumCorners(camera);

    const boundingBox = calculateBoundingBox(frustumCorners);

    let rangeX = boundingBox.maxX - boundingBox.minX;
    let centerX = (boundingBox.maxX + boundingBox.minX) / 2;
    let rangeY = boundingBox.maxZ - boundingBox.minZ;
    let centerY = (boundingBox.maxZ + boundingBox.minZ) / 2;

    let left = -rangeX / 2;
    let bottom = -rangeY / 2;
    let right = rangeX / 2;
    let top = rangeY / 2;

    let cam = new THREE.OrthographicCamera(left, right, top, bottom, 0.1, 2000);
    cam.position.set(centerX, 500, centerY);
    cam.rotation.set(-Math.PI / 2, 0, 0);
    cam.updateMatrixWorld( true );

    return cam;
}

export function getStableOrthographicCameraForPerspectiveCamera(camera, textureSize, textureResolution, centerPosition) {
    let texelSize = textureSize / textureResolution;
    let centerX = quantize(camera.position.x, texelSize);
    let centerY = camera.position.y;
    let centerZ = quantize(camera.position.z, texelSize);

    let left = -textureSize / 2;
    let right = textureSize / 2;
    let top = textureSize / 2;
    let bottom = -textureSize / 2;

    let cam = new THREE.OrthographicCamera(left, right, top, bottom, 0.1, 20000);
    cam.position.set(centerX, centerY, centerZ);
    cam.rotation.set(-Math.PI / 2, 0, 0);
    cam.updateMatrixWorld(true);

    return cam;
}

function quantize(value, quant) {
    return quant * Math.floor(value / quant);
}

export function getLightSpacePerspectiveCamera(camera) {
    let frustumCorners = calculateCameraFrustumCorners(camera);
    let boundingBox = calculateBoundingBox(frustumCorners);

    let center = new THREE.Vector3();
    for (let i = 0; i < frustumCorners.length; i++) {
        center.add(frustumCorners[i])
    }
    center.divideScalar(frustumCorners.length);

    let points = frustumCorners.map(it => it.clone().sub(camera.position));


    // let bboxCenter = new THREE.Vector3(
    //     (boundingBox.minX + boundingBox.maxX) / 2,
    //     (boundingBox.minY + boundingBox.maxY) / 2,
    //     (boundingBox.minZ + boundingBox.maxZ) / 2
    // )

    let camDir = new THREE.Vector3();
    camera.getWorldDirection(camDir);
    let projDir = camDir.clone();
    projDir.y = 0;
    projDir.normalize();

    let nearestPoint = null;
    let farthestPoint = null;
    let zn = Number.POSITIVE_INFINITY;
    let zf = Number.NEGATIVE_INFINITY;
    for (let i = 0; i < points.length; i++) {
        let p = points[i].clone();
        let dist = p.dot(camDir);
        if (dist < zn) {
            nearestPoint = frustumCorners[i];
            zn = dist;
        }
        if (dist > zf) {
            farthestPoint = frustumCorners[i];
            zf = dist;
        }
    }

    let sinGamma = Math.sin(camDir.angleTo(new THREE.Vector3(0, -1, 0)))
    let N = (zn + Math.sqrt(zn * zf)) / sinGamma;


    let fakePos = projDir.clone().multiplyScalar(-10000.0);

    let points2 = frustumCorners.map(it => it.clone().sub(fakePos));
    let nearestPoint2 = null;
    let farthestPoint2 = null;
    let zn2 = Number.POSITIVE_INFINITY;
    let zf2 = Number.NEGATIVE_INFINITY;
    for (let i = 0; i < points2.length; i++) {
        let p = points2[i].clone();
        let dist = p.dot(projDir);
        if (dist < zn2) {
            nearestPoint2 = frustumCorners[i];
            zn2 = dist;
        }
        if (dist > zf2) {
            farthestPoint2 = frustumCorners[i];
            zf2 = dist;
        }
    }

    let nearPlane = new THREE.Plane().setFromNormalAndCoplanarPoint(projDir.clone().multiplyScalar(-1), nearestPoint2);
    let farPlane = new THREE.Plane().setFromNormalAndCoplanarPoint(projDir.clone().multiplyScalar(-1), farthestPoint2);



    let p0 = new THREE.Vector3();
    nearPlane.projectPoint(farthestPoint2, p0);
    let d = Math.abs(farPlane.distanceToPoint(p0));

    let F = N + d;

    let centerDistanceToNearPlane = Math.abs(nearPlane.distanceToPoint(center));

    // it's too far away
    let newPos =center.clone();
    newPos.sub(projDir.clone().multiplyScalar(centerDistanceToNearPlane));
    newPos.sub(projDir.clone().multiplyScalar(N));




    // i know we care about the horizontal fov but consider this: it doesn't work anyway
    const perspectiveCamera = new THREE.PerspectiveCamera(90, 1, N, F);
    perspectiveCamera.position.set(newPos.x, newPos.y, newPos.z);
    perspectiveCamera.lookAt(newPos.clone().add(projDir));
    perspectiveCamera.updateMatrix();
    perspectiveCamera.updateMatrixWorld(true);
    perspectiveCamera.updateProjectionMatrix();

    /*while (perspectiveCamera.fov <= 180) {
        let frustum = new THREE.Frustum().setFromMatrix(new THREE.Matrix4().multiplyMatrices(perspectiveCamera.projectionMatrix, perspectiveCamera.matrixWorldInverse));
        let containsAllPoints = true;
        frustumCorners.forEach(c => {
            if (!frustum.containsPoint(c)) {
                containsAllPoints = false;
            }
        });
        if (containsAllPoints) {
            break;
        }
        perspectiveCamera.fov++;
        perspectiveCamera.updateProjectionMatrix();
    }*/

    return perspectiveCamera;

}

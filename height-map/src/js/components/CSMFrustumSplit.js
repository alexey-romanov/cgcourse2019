import * as THREE from "three-full";


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

function calculateCameraFrustumCorners(camera) {
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

export function getOrthographicCameraForPerspectiveCamera(
    camera,
    stable = false,
    texelSize
) {
    const frustumCorners = calculateCameraFrustumCorners(camera);

    // format: minX, minY, minZ, maxX, maxY, maxZ
    const boundingBox = calculateBoundingBox(frustumCorners);

    let rangeX = boundingBox.maxX - boundingBox.minX;
    let centerX = (boundingBox.maxX + boundingBox.minX) / 2;
    let rangeY = boundingBox.maxZ - boundingBox.minZ;
    let centerY = (boundingBox.maxZ + boundingBox.minZ) / 2;

    let left = -rangeX / 2;
    let bottom = -rangeY / 2;
    let right = rangeX / 2;
    let top = rangeY / 2;

    if (stable) {
        left = quantize(left, texelSize);
        bottom = quantize(bottom, texelSize);
        rangeX = quantize(rangeX, texelSize);
        rangeY = quantize(rangeY, texelSize);
        right = left + rangeX;
        top = bottom + rangeY;
        centerX = quantize(centerX, texelSize);
        centerY = quantize(centerY, texelSize);
    }

    let cam = new THREE.OrthographicCamera(left, right, top, bottom, 0.1, 2000);
    cam.position.set(centerX, 500, centerY);
    cam.rotation.set(-Math.PI / 2, 0, 0);
    cam.updateMatrixWorld( true );

    return cam;
}

function quantize(value, quant) {
    return quant * Math.floor(value / quant);
}

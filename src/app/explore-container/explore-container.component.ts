import {AfterViewInit, Component, ElementRef, OnInit, ViewChild} from '@angular/core';
import {
  AmbientLight, AnimationMixer,
  AxesHelper,
  BoxGeometry, BufferAttribute, BufferGeometry, CameraHelper,
  Color, CylinderGeometry, DirectionalLight, DirectionalLightHelper,
  GridHelper, Material, Mesh,
  MeshBasicMaterial, MeshPhongMaterial, MeshStandardMaterial, Object3DEventMap,
  PerspectiveCamera, PlaneGeometry, Raycaster,
  Scene, SphereGeometry, Texture, TextureLoader, Vector2,
  WebGLRenderer
} from "three";
import {OrbitControls} from "three/examples/jsm/controls/OrbitControls";
import {GUI} from "dat.gui";
import {GLTFLoader} from "three/examples/jsm/loaders/GLTFLoader";

@Component({
  selector: 'app-explore-container',
  templateUrl: './explore-container.component.html',
  styleUrls: ['./explore-container.component.scss'],
})
export class ExploreContainerComponent implements AfterViewInit{



  @ViewChild('threeCanvas')
  private canvasRef!: ElementRef;
  private scene!: Scene;
  private camera!: PerspectiveCamera;
  private controls!: OrbitControls;
  private renderer!: WebGLRenderer;
  private ambientLight!: AmbientLight;
  private directionalLight!: DirectionalLight;
  private sphere!: Mesh<SphereGeometry, MeshPhongMaterial>;
  private gui!: GUI;
  private mousePosition!: Vector2;
  private plane!: PlaneGeometry;
  private map!: Mesh<BufferGeometry, MeshBasicMaterial, Object3DEventMap>
  private options!: {
    wireframe: false
  };
  private rayCaster!: Raycaster;
  private mixer!: AnimationMixer;

  async ngAfterViewInit(): Promise<void> {
    this.scene = new Scene();
    this.camera = new PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );

    this.camera.position.set(1, 10, 7);

    this.controls = new OrbitControls(this.camera, this.canvasRef.nativeElement);

    this.renderer = new WebGLRenderer({canvas: this.canvasRef.nativeElement});

    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;

    const axesHelper = new AxesHelper(5);
    this.scene.add(axesHelper);

    const gridHelper = new GridHelper(20);
    this.scene.add(gridHelper);

    const cylinderGeometry = new CylinderGeometry(1,1,4);
    const textureCylinder = new TextureLoader().load('../../assets/WidePutin.png');
    const cylinderMaterial = new MeshStandardMaterial({map:textureCylinder});
    const cylinder = new Mesh(cylinderGeometry, cylinderMaterial);
    cylinder.castShadow = true;
    cylinder.receiveShadow = true;
    cylinder.position.set(-12,2,6)
    this.scene.add(cylinder)

    const planeGeometry = new PlaneGeometry(28, 15.66);
    const texturePlane = new TextureLoader().load('../../assets/john.png');
    const planeMaterial = new MeshPhongMaterial({map:texturePlane});
    const plane = new Mesh(planeGeometry, planeMaterial);
    plane.rotation.x = -90 * Math.PI / 180;
    plane.receiveShadow = true;
    this.scene.add(plane)

    const sphereGeometry = new SphereGeometry();
    const sphereMaterial = new MeshPhongMaterial({color: Color.NAMES.red, specular: Color.NAMES.white})
    this.sphere = new Mesh(sphereGeometry, sphereMaterial);
    this.sphere.position.x = 3;
    this.sphere.position.y = 2;
    this.sphere.name = 'flyingSphere';
    this.sphere.castShadow = true;
    this.scene.add(this.sphere);
    console.log(this.sphere.id);

    this.ambientLight = new AmbientLight(Color.NAMES.darkgray, 0.8);
    this.scene.add(this.ambientLight);

    this.directionalLight = new DirectionalLight(Color.NAMES.white, 1.0);
    this.directionalLight.position.set(-10, 15, 0)
    this.directionalLight.castShadow = true;
    this.directionalLight.shadow.camera.top = 10;
    this.scene.add(this.directionalLight);

    const directionalLightHelper = new DirectionalLightHelper(this.directionalLight);
    this.scene.add(directionalLightHelper);

    //Blender

    const gltfLoader = new GLTFLoader();
    gltfLoader.load('../../assets/human.glb',  (gltf) =>{
      gltf.scene.scale.set(4, 4, 4);
      gltf.scene.position.set(0,0,-25)
      gltf.scene.traverse((child) => {
          if ((child as Mesh).isMesh) {
            (child as Mesh).castShadow = true;
            (child as Mesh).receiveShadow = true;
            this.mixer = new AnimationMixer(child);
            const clips = gltf.animations;
            if(clips.length > 0) {
              this.mixer.clipAction(clips[0]).play();
            }
            (child as Mesh).material = new MeshStandardMaterial({
              color: Color.NAMES.rosybrown,
            });
            gltf.scene.castShadow = true;
          }
        }
      )
      this.scene.add(gltf.scene);
    });

    //Normalmap

    this.plane = new PlaneGeometry(32.768, 16.384);

    const materialNormalMap = new MeshPhongMaterial();
    const textureLoader = new TextureLoader();
    materialNormalMap.map = await textureLoader.loadAsync('../../assets/world.png');
    materialNormalMap.normalMap = await textureLoader.loadAsync('../../assets/earth_normalmap_8192x4096.jpg');
    materialNormalMap.normalScale.set(2, 2)

    const planeMesh = new Mesh(this.plane, materialNormalMap);

    planeMesh.rotation.x = -(Math.PI / 2);

    planeMesh.position.x = 32;

    this.scene.add(planeMesh);

    //Heightmap

    const loader = new TextureLoader();
    loader.load('../../assets/heightmap.png', (texture) => this.onTextureLoaded(texture))


    const cameraHelper = new CameraHelper(this.camera);
    this.scene.add(cameraHelper);

    this.initGui();

    this.mousePosition = new Vector2();

    window.addEventListener('mousemove',(e) => {
      this.mousePosition.x = (e.clientX / window.innerWidth) *2 - 1;
      this.mousePosition.y = -(e.clientY / window.innerHeight) * 2 + 1;
    });

    this.rayCaster = new Raycaster();

    this.renderer.setAnimationLoop((delay) => this.animate(delay));


  }

  private initGui() {
    this.gui = new GUI();

    this.options = {
      wireframe: false,
    };

    this.gui.add(this.options, 'wireframe').onChange((e) => {
      this.sphere.material.wireframe = e;
    });

  }


  private animate(delay: number): void {

    this.sphere.position.y = Math.sin(delay / 100) + 4;
    this.sphere.position.x = Math.cos(delay / 700) + 4;
    this.sphere.position.z = Math.cos(delay / 100);
    this.directionalLight.position.x = Math.sin(delay / 1000) * 5;
    this.directionalLight.position.z = Math.sin(delay / 1000) * 5;

    this.controls.update();

    this.rayCaster.setFromCamera(this.mousePosition, this.camera);

    const intersects = this.rayCaster.intersectObjects(this.scene.children);

    if(!intersects.find(x => x.object.id == this.sphere.id)){
      this.sphere.material.color.setHex(0xFF0000);
    }else{
      this.sphere.material.color.setHex(0x0000FF);
    }

    try{
      this.mixer.update( 0.005);
    }catch (e) {
      console.log(e)
    }



    this.renderer.render(this.scene, this.camera);


  }

  private generateTerrain(imageData: ImageData) {
    console.log(`imageData -> width: ${imageData.width}, height: ${imageData.height}, data.length: ${imageData.data.length}`);
    console.log(imageData.data)
    const indices: number[] = [];
    const vertices: number[] = [];
    const colors: number[] = [];
    let yValues: number[] = [];
    for (let z = 0; z < imageData.height; z++) {
      for (let x = 0; x < imageData.width; x++) {

        let y = 0;
        y += imageData.data[(z * imageData.height + x) * 4]
        y += imageData.data[(((z * imageData.height + x) * 4 ) + 1)]
        y += imageData.data[(((z * imageData.height + x) * 4 ) + 2)]

        yValues.push(y);
        vertices.push(x, y / 128, z);

      }
    }

    yValues.forEach(function (colorY: number) {
      const color = Number((colorY / 1000).toPrecision(3));
      let r = (color > 0.6 && color < 0.75 ? color / 3 : color);
      let g = 1 - color;
      let b = color;
      colors.push(r, g, b, 1);

    })

    for (let i = 0; i < imageData.height - 1; i++) {
      for (let j = 0; j < imageData.width - 1; j++) {
        const topLeft = j + i * imageData.width;
        const topRight = j + 1 + i * imageData.width;
        const bottomLeft = j + (i + 1) * imageData.width;
        const bottomRight = j + 1 + (i + 1) * imageData.width;

        indices.push(topLeft, topRight, bottomLeft);
        indices.push(topRight, bottomRight, bottomLeft);
      }
    }

    const geometry = new BufferGeometry();
    geometry.setIndex(indices);
    geometry.setAttribute('position', new BufferAttribute(new Float32Array(vertices), 3));
    geometry.setAttribute('color', new BufferAttribute(new Float32Array(colors), 4));

    const material = new MeshBasicMaterial();
    material.vertexColors = true;
    material.wireframe = true;


    this.map = new Mesh(geometry, material);

    this.map.position.x = -50;
    this.map.position.z = -15;
    this.map.position.y = -5;
    this.scene.add(this.map);
  }

  private onTextureLoaded(texture: Texture) {
    console.log('texture loaded')

    const canvas = document.createElement('canvas');
    canvas.width = texture.image.width;
    canvas.height = texture.image.height;

    const context = canvas.getContext('2d') as CanvasRenderingContext2D;
    context.drawImage(texture.image, 0, 0);
    const data = context.getImageData(0, 0, canvas.width, canvas.height);

    this.camera.position.x = data.width / 2;
    this.camera.position.y = data.height / 1.5;
    this.camera.position.z = data.width;
    this.camera.lookAt(data.width / 2, 0, data.width / 2);

    this.generateTerrain(data);
  }

}

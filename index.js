// chargement des librairies
import main_scene from "./src/js/main_scene.js";
import menu from "./src/js/menu.js";
import InputManager from "./src/js/InputManager.js";

// configuration générale du jeu
var config = {
  type: Phaser.WEBGL,
  render: { pixelArt: false, antialias: true}, 
  width: 1280, // largeur en pixels
  height: 720, // hauteur en pixels
   scale: {
        // Or set parent divId here
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH
   },
  physics: {
    // définition des parametres physiques
    default: "arcade", // mode arcade : le plus simple : des rectangles pour gérer les collisions. Pas de pentes
    arcade: {
      // parametres du mode arcade
      gravity: {
        y: 400 // gravité verticale : acceleration ddes corps en pixels par seconde
      },
      debug: false // permet de voir les hitbox et les vecteurs d'acceleration quand mis à true
    }
  },
  scene: [InputManager, menu, main_scene]
};

// création et lancement du jeu
export var game = new Phaser.Game(config);
game.scene.start("menu");
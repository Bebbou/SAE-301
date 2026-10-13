import * as fct from "./fonctions.js";

/***********************************************************************/
/** SYNOPSIS : deux pages d'histoire entre le menu et le niveau 1
/** le bouton "frapper / tirer" (K ou F) passe à la page suivante, puis lance la partie
/***********************************************************************/

// les pages selon le nombre de joueurs (images chargées dans selection.js ; le texte est dessiné dans l'image)
const PAGES_DUO = ["img_synopsis_1", "img_synopsis_2"]; // deux frères
const PAGES_SOLO = ["img_synopsis_solo", "img_synopsis_2"]; // Télégonos seul : la page 2 est la même
const DUREE_FONDU = 300; // ms
const DELAI_OUVERTURE = 250; // ms : le bouton qui a validé le menu est peut-être encore enfoncé, on ignore les touches un instant

// scene du synopsis : lancée par menu.js (qui a déjà remis la partie à zéro), elle enchaîne sur le niveau 1
// n'importe quel joueur peut passer à la page suivante
export default class synopsis extends Phaser.Scene {
  constructor() {
    super({ key: "synopsis" });
  }

  create() {
    this.cameras.main.setBackgroundColor("#080D1C");
    this.cameras.main.fadeIn(DUREE_FONDU);
    this.page = 0;
    this.verrou = true; // true : on ignore les touches (délai d'ouverture, puis chaque fondu)
    this.time.delayedCall(DELAI_OUVERTURE, () => { this.verrou = false; });

    this.pages = this.registry.get("nb_joueurs") === 1 ? PAGES_SOLO : PAGES_DUO;
    // les pages sont bien plus grandes que l'écran : on adoucit le filtre (le mode pixel art les rendrait crénelées)
    this.pages.forEach((cle) => this.textures.get(cle).setFilter(Phaser.Textures.FilterMode.LINEAR));
    this.image = this.add.image(0, 0, this.pages[0]).setOrigin(0, 0);
    this.ajusterImage();

    this.add.text(this.scale.width / 2, this.scale.height - 34, "Bouton : continuer", { fontFamily: fct.POLICES.texte, fontSize: "22px", color: "#E8EBF0", stroke: "#080D1C", strokeThickness: 5 })
      .setOrigin(0.5);

    // les touches des deux joueurs (cf. fonctions.js)
    this.touches = fct.JOUEURS.map((joueur) => fct.creerTouches(this, joueur.touches));
  }

  // la page remplit tout l'écran (changer de texture rend à l'image sa taille d'origine)
  ajusterImage() {
    this.image.setDisplaySize(this.scale.width, this.scale.height);
  }

  // fondu au noir, puis la page suivante (ou le niveau 1 après la dernière)
  suivante() {
    this.verrou = true;
    this.cameras.main.fadeOut(DUREE_FONDU);
    this.cameras.main.once("camerafadeoutcomplete", () => {
      this.page++;
      if (this.page >= this.pages.length) {
        this.sound.get("accueil")?.stop(); // la musique d'accueil a continué pendant le synopsis
        this.scene.start("niveau1", { niveau: 1 });
        return;
      }
      this.image.setTexture(this.pages[this.page]);
      this.ajusterImage();
      this.cameras.main.fadeIn(DUREE_FONDU);
      this.verrou = false;
    });
  }

  update() {
    if (this.verrou) return;
    if (this.touches.some((t) => Phaser.Input.Keyboard.JustDown(t.frapper_tirer))) this.suivante();
  }
}

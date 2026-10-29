import { BookOpen, ChevronRight, Radio, X } from "lucide-react";
import { evidenceSizes, evidenceSrcSet } from "../lib/image-performance";
import { sledAsset } from "../lib/sled-assets";

export type SceneTransitionData = {
  eyebrow: string;
  title: string;
  location: string;
  body: string;
  image: string;
  imageWidth: number;
  tone?: "cyan" | "success" | "danger";
};

type SceneTransitionProps = {
  scene: SceneTransitionData;
  onComplete: () => void;
};

export function SceneTransition({ scene, onComplete }: SceneTransitionProps) {
  const lead = scene.body.match(/^.*?[.!?](?:[»”"])?(?=\s|$)/)?.[0];

  return (
    <section className={`scene-transition tone-${scene.tone ?? "cyan"}`} role="dialog" aria-modal="true" aria-label={scene.title}>
      <div className="scene-transition-card">
        <div className="scene-transition-visual">
          <img
            src={sledAsset(scene.image)}
            srcSet={evidenceSrcSet(scene.image, scene.imageWidth)}
            sizes={evidenceSizes()}
            loading="eager"
            decoding="async"
            fetchPriority="high"
            alt=""
          />
          <div className="scene-transition-scan" aria-hidden="true" />
          <span className="scene-channel"><Radio /> КАНАЛ ЗАХВАЧЕН</span>
        </div>
        <div className="scene-transition-copy">
          <div className="scene-transition-kicker"><BookOpen /> {scene.eyebrow}</div>
          <small>{scene.location}</small>
          <h2>{scene.title}</h2>
          <p>
            {lead && lead.length < scene.body.length ? (
              <><strong className="scene-story-lead">{lead}</strong>{scene.body.slice(lead.length)}</>
            ) : scene.body}
          </p>
          <button onClick={onComplete}>ПРОДОЛЖИТЬ <ChevronRight /></button>
        </div>
        <button className="scene-transition-close" onClick={onComplete} aria-label="Пропустить заставку"><X /></button>
        <div className="scene-transition-progress" aria-hidden="true" />
      </div>
    </section>
  );
}

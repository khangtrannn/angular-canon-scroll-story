import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  NgZone,
  PLATFORM_ID,
  inject,
  viewChild,
  viewChildren,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

const FRAME_COUNT = 116;

@Component({
  selector: 'app-canon-product-page',
  templateUrl: './canon-product-page.component.html',
  styleUrl: './canon-product-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CanonProductPageComponent {
  private readonly destroyRef = inject(DestroyRef);
  private readonly ngZone = inject(NgZone);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  private readonly storyContainer =
    viewChild.required<ElementRef<HTMLElement>>('storyContainer');
  private readonly productCanvas =
    viewChild.required<ElementRef<HTMLCanvasElement>>('productCanvas');
  private readonly storySteps =
    viewChildren<ElementRef<HTMLElement>>('storyStep');

  private cleanupAnimations: (() => void) | undefined;

  constructor() {
    if (!this.isBrowser) {
      return;
    }

    afterNextRender(() => {
      this.ngZone.runOutsideAngular(() => this.setupScrollStory());
    });

    this.destroyRef.onDestroy(() => {
      this.cleanupAnimations?.();
    });
  }

  private setupScrollStory(): void {
    const canvas = this.productCanvas().nativeElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const prefersReducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;

    if (prefersReducedMotion) {
      const first = new Image();
      first.onload = () => ctx.drawImage(first, 0, 0, canvas.width, canvas.height);
      first.src = '/canon/frames/frame0001.jpg';
      return;
    }

    gsap.registerPlugin(ScrollTrigger);

    const frames: HTMLImageElement[] = [];
    let loadedCount = 0;

    const onFrameLoaded = (index: number): void => {
      loadedCount++;
      if (index === 0) {
        ctx.drawImage(frames[0], 0, 0, canvas.width, canvas.height);
      }
      if (loadedCount === FRAME_COUNT) {
        this.createScrollAnimations(frames, ctx, canvas);
      }
    };

    for (let i = 1; i <= FRAME_COUNT; i++) {
      const img = new Image();
      const frameIndex = i - 1;
      frames.push(img);
      img.onload = () => onFrameLoaded(frameIndex);
      img.onerror = () => onFrameLoaded(frameIndex);
      img.src = `/canon/frames/frame${String(i).padStart(4, '0')}.jpg`;
    }
  }

  private createScrollAnimations(
    frames: HTMLImageElement[],
    ctx: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
  ): void {
    const story = this.storyContainer().nativeElement;
    const steps = this.storySteps().map((step) => step.nativeElement);
    const lastFrame = frames.length - 1;

    const scrollContext = gsap.context(() => {
      gsap.set(steps, { opacity: 0, y: 36 });
      gsap.set(steps[0], { opacity: 1, y: 0 });

      ScrollTrigger.create({
        trigger: story,
        start: 'top top',
        end: 'bottom bottom',
        scrub: true,
        pin: '.canon-product__stage',
        anticipatePin: 1,
        invalidateOnRefresh: true,
        onUpdate: (self) => {
          const index = Math.round(self.progress * lastFrame);
          const frame = frames[index];
          if (frame?.complete) {
            ctx.drawImage(frame, 0, 0, canvas.width, canvas.height);
          }
        },
      });

      const textTimeline = gsap.timeline({
        scrollTrigger: {
          trigger: story,
          start: 'top top',
          end: 'bottom bottom',
          scrub: true,
        },
      });

      steps.forEach((step, index) => {
        const position = index / steps.length;

        textTimeline.to(
          step,
          {
            opacity: 1,
            y: 0,
            duration: 0.12,
            ease: 'power3.out',
          },
          position,
        );

        if (index < steps.length - 1) {
          textTimeline.to(
            step,
            {
              opacity: 0,
              y: -28,
              duration: 0.12,
              ease: 'power3.inOut',
            },
            position + 0.14,
          );
        }
      });

      gsap.to('.canon-product__scroll-hint', {
        opacity: 0,
        scrollTrigger: {
          trigger: story,
          start: 'top top',
          end: '4% top',
          scrub: true,
        },
      });
    }, story);

    const entranceContext = this.createEntranceAnimations();

    ScrollTrigger.refresh();

    this.cleanupAnimations = () => {
      scrollContext.revert();
      entranceContext.revert();
    };
  }

  private createEntranceAnimations(): gsap.Context {
    return gsap.context(() => {
      gsap.from('.canon-product__section-intro > *', {
        opacity: 0,
        y: 28,
        duration: 0.7,
        ease: 'power3.out',
        stagger: 0.12,
        scrollTrigger: {
          trigger: '.canon-product__section-intro',
          start: 'top 82%',
          toggleActions: 'play none none none',
        },
      });

      gsap.from('.canon-product__feature-grid article', {
        opacity: 0,
        y: 48,
        duration: 0.65,
        ease: 'power3.out',
        stagger: 0.1,
        scrollTrigger: {
          trigger: '.canon-product__feature-grid',
          start: 'top 85%',
          toggleActions: 'play none none none',
        },
      });

      gsap.from('.canon-product__specs > div:first-child > *', {
        opacity: 0,
        y: 24,
        duration: 0.65,
        ease: 'power3.out',
        stagger: 0.1,
        scrollTrigger: {
          trigger: '.canon-product__specs',
          start: 'top 82%',
          toggleActions: 'play none none none',
        },
      });

      gsap.from('.canon-product__specs dl > div', {
        opacity: 0,
        y: 16,
        duration: 0.5,
        ease: 'power3.out',
        stagger: 0.07,
        scrollTrigger: {
          trigger: '.canon-product__specs dl',
          start: 'top 85%',
          toggleActions: 'play none none none',
        },
      });

      gsap.from('.canon-product__cta > div', {
        opacity: 0,
        y: 36,
        duration: 0.7,
        ease: 'power3.out',
        stagger: 0.15,
        scrollTrigger: {
          trigger: '.canon-product__cta',
          start: 'top 82%',
          toggleActions: 'play none none none',
        },
      });
    });
  }
}

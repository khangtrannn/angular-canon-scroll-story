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
import { isPlatformBrowser, NgOptimizedImage } from '@angular/common';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

const FRAME_COUNT = 116;
const INITIAL_FRAME_BATCH = 20;
const EASE_OUT_EXPO = 'expo.out';

@Component({
  selector: 'app-canon-product-page',
  imports: [NgOptimizedImage],
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
  private readonly navBar = viewChild.required<ElementRef<HTMLElement>>('navBar');

  private cleanupAnimations: (() => void) | undefined;

  constructor() {
    if (!this.isBrowser) {
      return;
    }

    afterNextRender(() => {
      this.ngZone.runOutsideAngular(() => {
        this.setupNavScroll();
        this.setupScrollStory();
      });
    });

    this.destroyRef.onDestroy(() => {
      this.cleanupAnimations?.();
    });
  }

  private setupNavScroll(): void {
    const nav = this.navBar().nativeElement;
    const update = () => {
      nav.classList.toggle('is-scrolled', window.scrollY > 8);
    };
    update();
    window.addEventListener('scroll', update, { passive: true });
    this.destroyRef.onDestroy(() =>
      window.removeEventListener('scroll', update),
    );
  }

  private setupScrollStory(): void {
    const canvas = this.productCanvas().nativeElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const prefersReducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;

    if (prefersReducedMotion) {
      const last = new Image();
      last.onload = () =>
        ctx.drawImage(last, 0, 0, canvas.width, canvas.height);
      last.src = '/canon/frames/frame0116.jpg';
      return;
    }

    gsap.registerPlugin(ScrollTrigger);

    const frames: HTMLImageElement[] = new Array(FRAME_COUNT);
    let initialBatchLoaded = 0;
    let animationsStarted = false;

    const onFrameLoaded = (index: number): void => {
      if (index === 0) {
        ctx.drawImage(frames[0], 0, 0, canvas.width, canvas.height);
      }
      if (index < INITIAL_FRAME_BATCH) {
        initialBatchLoaded++;
        if (
          initialBatchLoaded >= INITIAL_FRAME_BATCH &&
          !animationsStarted
        ) {
          animationsStarted = true;
          this.createScrollAnimations(frames, ctx, canvas);
        }
      }
    };

    for (let i = 1; i <= FRAME_COUNT; i++) {
      const img = new Image();
      const frameIndex = i - 1;
      frames[frameIndex] = img;
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
    const finalMap = story.querySelector<HTMLElement>('.canon-product__final-map');
    const lastFrame = frames.length - 1;

    steps.forEach((step) => {
      const headline = step.querySelector('h1, h2');
      const sub = step.querySelector('p:last-of-type');
      if (headline instanceof HTMLElement) {
        this.splitIntoWords(headline);
      }
      if (sub instanceof HTMLElement && sub !== headline) {
        this.splitIntoWords(sub);
      }
    });

    const scrollContext = gsap.context(() => {
      gsap.set(steps, { opacity: 0, y: 0 });
      gsap.set('.word', { y: 80, opacity: 0 });
      gsap.set('.canon-product__final-map', { autoAlpha: 0 });
      gsap.set('.canon-product__callout', { y: 24, opacity: 0 });

      // First chapter renders immediately and plays a once-only word reveal
      // on mount so the page isn't blank at scroll=0.
      const firstStep = steps[0];
      const firstWords = firstStep.querySelectorAll<HTMLElement>('.word');
      gsap.set(firstStep, { opacity: 1 });
      gsap.set(firstWords, { y: 0, opacity: 1 });
      gsap.from(firstWords, {
        y: 80,
        opacity: 0,
        duration: 1.1,
        ease: EASE_OUT_EXPO,
        stagger: 0.04,
        delay: 0.15,
      });

      const drawNearestLoaded = (targetIndex: number) => {
        for (let i = targetIndex; i >= 0; i--) {
          const frame = frames[i];
          if (frame?.complete && frame.naturalWidth > 0) {
            ctx.drawImage(frame, 0, 0, canvas.width, canvas.height);
            return;
          }
        }
      };

      ScrollTrigger.create({
        trigger: story,
        start: 'top top',
        end: 'bottom bottom',
        scrub: true,
        pin: '.canon-product__stage',
        anticipatePin: 1,
        invalidateOnRefresh: true,
        onUpdate: (self) => {
          const frameProgress = Math.min(self.progress / 0.92, 1);
          const index = Math.round(frameProgress * lastFrame);
          drawNearestLoaded(index);
        },
      });

      const textTimeline = gsap.timeline({
        scrollTrigger: {
          trigger: story,
          start: 'top top',
          end: 'bottom bottom',
          scrub: 1,
        },
      });

      const chapterCount = steps.length;
      steps.forEach((step, idx) => {
        const chapterStart = idx / chapterCount;
        const chapterEnd = (idx + 1) / chapterCount;
        const chapterSpan = chapterEnd - chapterStart;
        const revealDuration = chapterSpan * 0.55;
        const isFinalChapter = idx === chapterCount - 1;
        const exitStart =
          isFinalChapter && finalMap
            ? 0.88
            : chapterStart + chapterSpan * 0.78;
        const exitDuration =
          isFinalChapter && finalMap ? 0.05 : chapterSpan * 0.22;

        const words = step.querySelectorAll<HTMLElement>('.word');

        // Chapter 0 is already visible from the once-only mount animation,
        // so the scrubbed timeline skips its entry tween and only handles
        // its exit. Chapters 1+ get the full scrub-tied per-word reveal.
        if (idx > 0) {
          textTimeline.set(step, { opacity: 1 }, chapterStart);
          textTimeline.to(
            words,
            {
              y: 0,
              opacity: 1,
              duration: revealDuration,
              ease: EASE_OUT_EXPO,
              stagger: {
                each: chapterSpan * 0.02,
                ease: 'none',
              },
            },
            chapterStart,
          );
        }

        if (idx < chapterCount - 1 || finalMap) {
          textTimeline.to(
            step,
            {
              opacity: 0,
              y: -40,
              duration: exitDuration,
              ease: 'expo.in',
            },
            exitStart,
          );
        }
      });

      if (finalMap) {
        textTimeline.set('.canon-product__media', { zIndex: 2 }, 0.88);
        textTimeline.to(
          '.canon-product__media',
          {
            x: () => {
              const media = story.querySelector<HTMLElement>('.canon-product__media');
              const stageRect = story
                .querySelector<HTMLElement>('.canon-product__stage')
                ?.getBoundingClientRect();
              const canvasRect = canvas.getBoundingClientRect();
              if (!stageRect || !media) {
                return 0;
              }

              const stageCenter = stageRect.left + stageRect.width / 2;
              const canvasCenter = canvasRect.left + canvasRect.width / 2;
              const currentX = Number(gsap.getProperty(media, 'x')) || 0;
              return currentX + stageCenter - canvasCenter;
            },
            duration: 0.16,
            ease: 'power1.inOut',
          },
          0.8,
        );
        textTimeline.to(finalMap, { autoAlpha: 1, duration: 0.035 }, 0.945);
        textTimeline.to(
          '.canon-product__callout',
          {
            y: 0,
            opacity: 1,
            duration: 0.045,
            ease: EASE_OUT_EXPO,
            stagger: {
              each: 0.008,
              from: 'random',
            },
          },
          0.955,
        );
      }

      gsap.to('.canon-product__scroll-hint', {
        opacity: 0,
        scrollTrigger: {
          trigger: story,
          start: 'top top',
          end: '5% top',
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

  private splitIntoWords(element: HTMLElement): HTMLElement[] {
    const text = element.textContent ?? '';
    element.textContent = '';

    const wordList: HTMLElement[] = [];
    const tokens = text.split(/(\s+)/);
    for (const token of tokens) {
      if (token.length === 0) continue;
      if (/^\s+$/.test(token)) {
        element.appendChild(document.createTextNode(token));
        continue;
      }
      const wrapper = document.createElement('span');
      wrapper.className = 'word';
      wrapper.textContent = token;
      element.appendChild(wrapper);
      wordList.push(wrapper);
    }
    return wordList;
  }

  private createEntranceAnimations(): gsap.Context {
    return gsap.context(() => {
      gsap.from('.canon-product__section-intro > *', {
        opacity: 0,
        y: 40,
        duration: 1.1,
        ease: EASE_OUT_EXPO,
        stagger: 0.08,
        scrollTrigger: {
          trigger: '.canon-product__section-intro',
          start: 'top 82%',
          toggleActions: 'play none none none',
        },
      });

      gsap.from('.canon-product__feature-mosaic article', {
        opacity: 0,
        y: 60,
        duration: 1.1,
        ease: EASE_OUT_EXPO,
        stagger: 0.1,
        scrollTrigger: {
          trigger: '.canon-product__feature-mosaic',
          start: 'top 85%',
          toggleActions: 'play none none none',
        },
      });

      gsap.from('.canon-product__specs-intro > *', {
        opacity: 0,
        y: 32,
        duration: 1.0,
        ease: EASE_OUT_EXPO,
        stagger: 0.08,
        scrollTrigger: {
          trigger: '.canon-product__specs',
          start: 'top 82%',
          toggleActions: 'play none none none',
        },
      });

      gsap.from('.canon-product__specs dl > div', {
        opacity: 0,
        y: 24,
        duration: 0.9,
        ease: EASE_OUT_EXPO,
        stagger: 0.06,
        scrollTrigger: {
          trigger: '.canon-product__specs dl',
          start: 'top 85%',
          toggleActions: 'play none none none',
        },
      });

      gsap.from('.canon-product__cta-inner > *', {
        opacity: 0,
        y: 48,
        duration: 1.1,
        ease: EASE_OUT_EXPO,
        stagger: 0.1,
        scrollTrigger: {
          trigger: '.canon-product__cta',
          start: 'top 82%',
          toggleActions: 'play none none none',
        },
      });
    });
  }
}

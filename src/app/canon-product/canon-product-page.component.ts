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
  private readonly productVideo =
    viewChild.required<ElementRef<HTMLVideoElement>>('productVideo');
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
    const video = this.productVideo().nativeElement;
    const prefersReducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;

    video.pause();
    video.currentTime = 0;

    if (prefersReducedMotion) {
      return;
    }

    gsap.registerPlugin(ScrollTrigger);

    const runWhenMetadataIsReady = (): void => {
      if (!Number.isFinite(video.duration) || video.duration <= 0) {
        return;
      }

      this.createScrollAnimations(video);
    };

    if (video.readyState >= HTMLMediaElement.HAVE_METADATA) {
      runWhenMetadataIsReady();
      return;
    }

    video.addEventListener('loadedmetadata', runWhenMetadataIsReady, {
      once: true,
    });
    video.load();

    this.cleanupAnimations = () => {
      video.removeEventListener('loadedmetadata', runWhenMetadataIsReady);
    };
  }

  private createScrollAnimations(video: HTMLVideoElement): void {
    const story = this.storyContainer().nativeElement;
    const steps = this.storySteps().map((step) => step.nativeElement);
    const endTime = Math.max(video.duration - 0.05, 0);

    const context = gsap.context(() => {
      gsap.set(steps, { opacity: 0, y: 36 });
      gsap.set(steps[0], { opacity: 1, y: 0 });

      gsap.to(video, {
        currentTime: endTime,
        ease: 'none',
        scrollTrigger: {
          trigger: story,
          start: 'top top',
          end: 'bottom bottom',
          scrub: true,
          pin: '.canon-product__stage',
          anticipatePin: 1,
          invalidateOnRefresh: true,
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
    }, story);

    ScrollTrigger.refresh();

    this.cleanupAnimations = () => {
      context.revert();
    };
  }
}

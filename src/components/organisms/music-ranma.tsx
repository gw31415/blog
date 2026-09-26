import { component$, useSignal, useVisibleTask$ } from "@qwik.dev/core";
import { css } from "@qstyle/qwik";

import { deerLegPath } from "./ranma-deer-leg";
import deerMotion from "./ranma-deer-motion.json";

/** Scroll scrubs the SVG; no timers or reactive renders run while the page rests. */
export const MusicRanma = component$(() => {
  const scene = useSignal<HTMLDivElement>();
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(
    ({ cleanup }) => {
      const element = scene.value;
      if (!element) return;
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
      let frame = 0;
      let start = 0;
      let distance = 1;
      const stags = element.querySelectorAll(".ranma-walking-stag");
      const torsos = element.querySelectorAll(".ranma-deer-torso");
      const legs = Array.from(element.querySelectorAll<SVGPathElement>(".ranma-walking-leg"));
      const neck = element.querySelector(".ranma-peck-neck");
      const head = element.querySelector(".ranma-peck-head");
      const paint = () => {
        frame = 0;
        const progress = reduced.matches
          ? 0
          : Math.min(1, Math.max(0, (window.scrollY - start) / distance));
        element.style.setProperty("--ranma-progress", String(progress));
        // One unhurried stride. During stance the hoof stays fixed in world space.
        const walking = Math.min(1, progress / 0.56);
        const stride = walking * walking * (3 - 2 * walking);
        const travel = stride * deerMotion.travel;
        stags.forEach((stag) => stag.setAttribute("transform", `translate(${165 + travel} 173)`));
        torsos.forEach((torso) =>
          torso.setAttribute(
            "transform",
            `translate(0 ${-deerMotion.bob * Math.sin(stride * Math.PI * 2) ** 2}) rotate(${Math.sin(stride * Math.PI * 2) * deerMotion.rock} 0 -68)`,
          ),
        );
        legs.forEach((leg, index) => {
          leg.setAttribute("d", deerLegPath(stride, index));
        });
        // Start feeding; only a small neck and bill movement accompanies the scroll.
        const dip = 0.91 + 0.07 * Math.sin(Math.PI * progress) ** 2;
        const hx = -24 - dip * 43;
        const hy = -140 + dip * 105;
        neck?.setAttribute(
          "d",
          `M-16 -82 C-27 -74 -22 -47 -39 -49 S${hx + 16} ${hy - 9} ${hx} ${hy}`,
        );
        head?.setAttribute("transform", `translate(${hx} ${hy}) rotate(${-dip * 68})`);
      };
      const schedule = () => {
        if (!frame) frame = requestAnimationFrame(paint);
      };
      const measure = () => {
        start = Math.max(0, element.getBoundingClientRect().top + window.scrollY - 48);
        distance = Math.max(440, element.getBoundingClientRect().height * 2);
        schedule();
      };
      const resize = new ResizeObserver(measure);
      resize.observe(element);
      window.addEventListener("scroll", schedule, { passive: true });
      window.addEventListener("resize", measure);
      reduced.addEventListener("change", schedule);
      measure();
      cleanup(() => {
        cancelAnimationFrame(frame);
        resize.disconnect();
        window.removeEventListener("scroll", schedule);
        window.removeEventListener("resize", measure);
        reduced.removeEventListener("change", schedule);
      });
    },
    { strategy: "document-ready" },
  );
  return (
    <div ref={scene} css={ranmaStyles} class="music-ranma" aria-hidden="true">
      <svg viewBox="0 0 960 248" fill="none" xmlns="http://www.w3.org/2000/svg" focusable="false">
        <defs>
          {/* Front elevation: broad bouts, long C-bouts and four pointed corners. */}
          <g id="ranma-violin-solid">
            <path d="M0-52C-19-53-34-40-33-27C-33-16-27-9-30-3C-22-5-20 1-20 10C-20 21-24 33-35 31C-32 40-39 47-40 60C-43 80-24 88 0 88C24 88 43 80 40 60C39 47 32 40 35 31C24 33 20 21 20 10C20 1 22-5 30-3C27-9 33-16 33-27C34-40 19-53 0-52Z" />
            <path d="M-4-91H4L5-51H-5ZM-5-113H5L6-87H-6Z" />
            <path d="M-3-134C-6-133-6-128-7-124C-12-125-14-118-10-114L-6-111H6L10-114C14-118 12-125 7-124C6-128 6-133 3-134Z" />
            <path d="M-6-103H-12V-100H-6ZM6-109H12V-106H6ZM-6-90H-12V-87H-6ZM6-96H12V-93H6Z" />
            <ellipse cx="-13" cy="-101.5" rx="4" ry="3.1" />
            <ellipse cx="13" cy="-107.5" rx="4" ry="3.1" />
            <ellipse cx="-13" cy="-88.5" rx="4" ry="3.1" />
            <ellipse cx="13" cy="-94.5" rx="4" ry="3.1" />
          </g>
          <g id="ranma-f-hole" fill="black">
            <path
              d="M-10 14C-9 10-14 9-15 15C-17 22-15 31-20 36C-23 40-27 38-25 35"
              fill="none"
              stroke="black"
              stroke-width="2"
              stroke-linecap="round"
            />
            <circle cx="-10" cy="14" r="1.8" />
            <circle cx="-25" cy="35" r="2.1" />
            <path d="m-16.5 25 2.5-1-1 2Z" />
          </g>
          <linearGradient id="ranma-score-fade">
            <stop offset="0" stop-color="black" />
            <stop offset=".08" stop-color="white" />
            <stop offset=".9" stop-color="white" />
            <stop offset="1" stop-color="black" />
          </linearGradient>
          <mask
            id="ranma-score-space"
            maskUnits="userSpaceOnUse"
            x="300"
            y="55"
            width="370"
            height="130"
          >
            <path d="M300 55H670V185H300Z" fill="url(#ranma-score-fade)" />
          </mask>
          <mask
            id="ranma-staff-depth"
            maskUnits="userSpaceOnUse"
            x="0"
            y="0"
            width="960"
            height="248"
          >
            <path d="M0 0H960V248H0Z" fill="white" />
            <use
              href="#ranma-violin-solid"
              transform="translate(480 134) rotate(14) scale(.84)"
              fill="black"
              stroke="black"
              stroke-width="4"
            />
          </mask>
          <mask
            id="ranma-cloud-space"
            maskUnits="userSpaceOnUse"
            x="0"
            y="0"
            width="960"
            height="248"
          >
            <path d="M0 0H960V248H0Z" fill="white" />
            <g class="ranma-walking-stag" transform="translate(165 173)" style="color: black">
              <use href="#ranma-stag" stroke="black" stroke-width="14" stroke-linejoin="round" />
            </g>
            <use
              href="#ranma-bird"
              transform="translate(358 55) scale(.75)"
              style="color: black"
              stroke="black"
              stroke-width="14"
            />
            <use
              href="#ranma-violin-solid"
              transform="translate(480 134) rotate(14) scale(.84)"
              fill="black"
              stroke="black"
              stroke-width="14"
            />
            <use
              href="#ranma-crane"
              transform="translate(805 173)"
              style="color: black"
              stroke="black"
              stroke-width="12"
              stroke-linejoin="round"
            />
          </mask>
          <mask
            id="ranma-violin-cutouts"
            x="-60"
            y="-140"
            width="120"
            height="245"
            maskUnits="userSpaceOnUse"
          >
            <path d="M-60-140H60V105H-60Z" fill="white" />
            <path d="M-1-88H1L2.4 3H-2.4Z" fill="black" />
            <path d="M-6 48Q0 46 6 48L2.5 76H-2.5Z" fill="black" />
            <path d="M-9 28Q0 25 9 28" fill="none" stroke="black" stroke-width="1.4" />
            <use href="#ranma-f-hole" />
            <use href="#ranma-f-hole" transform="scale(-1 1)" />
            {/* Paired grooves describe the scroll from the same frontal viewpoint. */}
            <path
              d="M-2-132C-3-126-5-120-3-114M2-132C3-126 5-120 3-114M-8-122C-11-120-10-117-7-116M8-122C11-120 10-117 7-116"
              fill="none"
              stroke="black"
              stroke-width="1.2"
              stroke-linecap="round"
            />
            <path d="M-2-109H2V-94H-2Z" fill="black" />
          </mask>
          <clipPath id="ranma-opening">
            <path
              transform="translate(0 248) scale(1 -1)"
              d="M0 76H258Q276 76 285 61L303 38H399Q420 38 437 26H523Q540 38 561 38H657L675 61Q684 76 702 76H960V237H0Z"
            />
          </clipPath>
          {/* Sweeping outlined cloud banks, glimpsed behind the branches. */}
          <g id="ranma-cloud" stroke="currentColor" stroke-width="2" stroke-linejoin="round">
            <path d="M-90 13H192Q218 13 218 24Q218 35 197 35H166Q150 35 150 43Q150 51 171 51H359Q389 51 389 63Q389 75 363 75H87Q62 75 62 83Q62 92 84 92H148Q165 92 165 101Q165 110 142 110H-90" />
            <path d="M-80 48H36Q53 48 53 42Q53 36 37 36H11M261 29H379Q399 29 399 20Q399 11 382 11H351" />
          </g>
          {/* A lower, longer bank balances the dense upper-left canopy without filling the sky. */}
          <g id="ranma-cloud-low" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round">
            <path d="M1030 63H904Q880 63 880 73Q880 83 906 83H935Q950 83 950 90Q950 97 932 97H756Q724 97 724 109Q724 121 756 121H1030" />
          </g>
          <g id="ranma-grass" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <path d="M0 0Q-3-25-16-37M0 0Q4-28 10-43M0 0Q15-17 26-20M0 0Q-17-13-25-16" />
            <path
              d="M-16-37Q-29-40-31-54Q-14-48-16-37M10-43Q7-57 18-68Q21-49 10-43M6-23Q18-37 34-35Q24-22 6-23"
              fill="currentColor"
              stroke="none"
            />
          </g>
          <g id="ranma-leaf" fill="currentColor">
            <path d="M0 0C-20-5-33-22-40-47-19-33-7-19 0 0ZM1 0C9-22 27-33 49-36 28-17 16-7 1 0Z" />
          </g>
        </defs>

        <g clip-path="url(#ranma-opening)">
          <g transform="translate(697 40)">
            <g class="ranma-motion ranma-moon" fill="currentColor">
              <path d="M9-22A24 24 0 1 0 22 9A24 24 0 0 1 9-22Z" />
            </g>
          </g>
          <g mask="url(#ranma-cloud-space)">
            <g transform="translate(-8 0) scale(1 .7)">
              <use class="ranma-motion ranma-cloud-drift" href="#ranma-cloud" />
            </g>
            <use class="ranma-motion ranma-cloud-drift" href="#ranma-cloud-low" />
          </g>
          <g mask="url(#ranma-staff-depth)">
            <g mask="url(#ranma-score-space)">
              <g class="ranma-motion ranma-current" stroke="currentColor" stroke-width="1.5">
                {[0, 8, 16, 24, 32].map((offset) => (
                  <path
                    key={offset}
                    transform={`translate(0 ${offset})`}
                    d="M-80 98C86 35 194 39 298 74S483 126 596 83S813 41 1040 98"
                  />
                ))}
              </g>
            </g>
          </g>
          <g transform="translate(0 -32)">
            <g stroke="currentColor" stroke-width="3" stroke-linecap="round">
              <path d="M0 237C101 235 179 257 254 214S360 182 422 256M538 256C600 182 631 172 706 214S859 235 960 237" />
            </g>
            <use href="#ranma-leaf" transform="translate(292 198) rotate(22) scale(.58)" />
            <use href="#ranma-leaf" transform="translate(668 198) rotate(-22) scale(.58)" />

            <g
              class="ranma-motion ranma-current"
              fill="currentColor"
              stroke="currentColor"
              stroke-width="2.5"
            >
              <g transform="translate(190 46)">
                <g class="ranma-motion ranma-note-turn">
                  <path d="M155 111V76L183 70V104" fill="none" />
                  <path d="M155 76 183 70V75L155 81Z" />
                  <ellipse cx="149" cy="112" rx="7" ry="4.5" transform="rotate(-22 149 112)" />
                  <ellipse cx="177" cy="105" rx="7" ry="4.5" transform="rotate(-22 177 105)" />
                </g>
              </g>
              <g transform="translate(-135 10)">
                <g class="ranma-motion ranma-note-turn">
                  <path d="M752 138V103" fill="none" />
                  <path
                    d="M752 103C755 112 773 111 764 125C769 115 758 117 752 111Z"
                    stroke="none"
                  />
                  <ellipse cx="746" cy="139" rx="7" ry="4.5" transform="rotate(-22 746 139)" />
                </g>
              </g>
            </g>
          </g>
          {/* Pines: the visible crowns lead into tapering limbs and a rooted trunk. */}
          <g fill="currentColor">
            <path d="M-12 183 8 161C18 143 24 124 27 102C32 78 43 61 61 44L76 15 84 16 72 48C53 73 48 92 47 111C46 138 48 158 60 180Z" />
            <path d="M32 111C12 98-2 89-22 86L-25 77C1 79 24 90 39 97ZM42 85C67 73 86 62 96 44L100 27 107 29 104 48C94 70 71 82 43 94ZM59 59 31 49 3 51-2 46 31 40 64 49ZM76 39 111 24 150 27 156 32 111 31 70 49Z" />
            <path d="M905 182C923 159 927 136 925 115C922 91 911 72 902 51L896 9 907 7 914 48C930 65 939 88 944 111L949 155 969 183Z" />
            <path d="M932 112C951 90 971 85 992 86V77C965 78 945 85 929 100ZM923 85C888 81 871 72 852 56L833 35 839 31 859 50C879 65 901 68 917 69ZM907 54 938 43 963 19 970 24 944 49 913 64Z" />
            {[
              [18, 62, -7, 1.15],
              [89, 39, 6, 1.1],
              [146, 21, 3, 0.65],
              [34, 16, -4, 1.2],
              [850, 39, -7, 0.85],
              [907, 21, 8, 1.2],
              [961, 61, -9, 1.15],
            ].map(([x, y, angle, scale]) => (
              <g key={x} transform={`translate(${x} ${y}) rotate(${angle}) scale(${scale})`}>
                <path d="M-51 8-43 0-42 5-36-9-33-4-26-17-25-9-16-22-17-13-5-26-8-16 4-24 3-14 15-21 13-12 24-15 21-7 34-10 31-3 43-3 39 3 53 8Q26 17 2 10Q-26 18-51 8Z" />
                <path d="M-38 11-3 22 32 11 4 26 1 36-3 35-5 26Z" />
              </g>
            ))}
            <path d="M308-14 326 36Q338 55 378 69L391 74Q340 70 317 40L294-14Z" />
            <path d="M319 27 350 17 369 20 371 23 350 22 323 34Z" />
          </g>
          <g transform="translate(358 55) scale(.75)">
            <g>
              <g id="ranma-bird" fill="currentColor">
                <path d="M-7 5C-10-6-4-17 5-21L25-18C25-7 22 1 13 9L-17 25Z" />
                <g class="ranma-motion ranma-perched-head">
                  <path d="M2-17C5-29 19-32 27-25L37-22 27-20 24-11Z" />
                </g>
                <g class="ranma-motion ranma-perched-tail">
                  <path d="M-5 0 12 9-16 37-23 39-18 29-30 41-33 40-19 17Z" />
                </g>
                <path d="M5 5 8 15 17 17 9 18 5 16 2 8M13 3 16 13 23 15 15 16 11 6Z" />
              </g>
            </g>
          </g>
          <g transform="translate(612 38) scale(.57)">
            <g class="ranma-motion ranma-bird-flight">
              <g id="ranma-flying-bird" fill="currentColor">
                <g class="ranma-motion ranma-far-wing">
                  <path d="M-7 4C-11-13-3-27 12-39L8-24 20-34 14-16 19-20 9 5Z" />
                </g>
                <path d="M-22-1C-11-7 0-5 10-5C15-11 23-10 27-5L37-2 27 0C16 5 9 10-3 9L-22 7Z" />
                <g class="ranma-motion ranma-flight-tail">
                  <path d="M-17-1-49 1-52 4-51 10-44 13-15 7Z" />
                </g>
                <g class="ranma-motion ranma-wing">
                  <path d="M-12 3C-7-12-4-25-26-47L-29-47-19-32-29-42-31-40-20-27-31-35-31-31-19-20-28-25-27-20C-16-12-17 2-7 7Z" />
                </g>
              </g>
            </g>
          </g>
          <g class="ranma-animal-ground ranma-walking-stag" transform="translate(165 173)">
            <g id="ranma-stag" fill="currentColor">
              {[0, 1, 2, 3].map((leg) => (
                <path key={leg} class="ranma-walking-leg" d={deerLegPath(0, leg)} />
              ))}
              <g class="ranma-deer-torso">
                <path d="M-76-68C-81-88-57-101-35-94C-15-90 0-88 25-90C44-94 55-82 56-67C53-52 25-47 1-53C-20-45-47-49-63-51Z" />
                <g class="ranma-motion ranma-deer-tail">
                  <path d="M-73-81C-83-81-87-75-88-69L-83-72-84-63Q-75-66-70-75Z" />
                </g>
                <g class="ranma-motion ranma-deer-head">
                  <path
                    fill-rule="evenodd"
                    d="M30-81C45-100 46-112 58-126C63-139 77-134 80-128L91-122 112-114Q119-108 112-104L88-106C80-100 73-86 65-72Q54-59 36-48L29-55Q47-69 44-81Z"
                  />
                  <path d="M70-128Q76-142 86-141Q88-134 76-126Z" />
                  <g class="ranma-motion ranma-deer-ear">
                    <path d="M61-126Q42-127 42-140Q57-141 65-128Z" />
                  </g>
                  <path
                    d="M65-132Q49-141 49-153M54-143 38-148 34-155M50-150 57-157M70-132Q78-143 72-156M77-145 89-153 92-160M75-151 65-158"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="3"
                    stroke-linecap="round"
                  />
                </g>
              </g>
            </g>
          </g>
          <g class="ranma-animal-ground" transform="translate(805 173)">
            <g id="ranma-crane" fill="currentColor">
              <path d="M-21-91C-6-99 18-92 29-76C33-66 40-54 49-46L34-49 39-41 25-47 28-38 13-46C-9-41-36-57-21-91Z" />
              <path d="M-12-51-8-26-10-4-24 0H-6L-4-3 7 0H14L-3-6-2-28-5-53Z" />
              <g>
                <path d="M9-49 16-28 21-4 33 0H18L16-4 8 0H3L15-7 10-28 3-50Z" />
              </g>
              <path
                class="ranma-peck-neck"
                d="M-16-82C-27-74-22-47-39-49S-47.13-53.45-63.13-44.45"
                fill="none"
                stroke="currentColor"
                stroke-width="9"
                stroke-linecap="round"
              />
              <g class="ranma-peck-head" transform="translate(-63.13 -44.45) rotate(-61.88)">
                <path d="M-4-6C5-10 13-3 9 4Q5 9-5 5L-37 1Z" />
              </g>
            </g>
          </g>
          {[32, 65, 893, 934].map((x) => (
            <g key={x} transform={`translate(${x} 173) scale(${x > 480 ? -0.65 : 0.65} .65)`}>
              <use class="ranma-motion ranma-reed" href="#ranma-grass" />
            </g>
          ))}
          {[[258, 126]].map(([x, y]) => (
            <g key={x} transform={`translate(${x} ${y})`}>
              <path
                class="ranma-motion ranma-petal"
                d="M0 0Q-11-12-5-19Q8-15 0 0Z"
                fill="currentColor"
              />
            </g>
          ))}
          <g transform="translate(480 134) rotate(14) scale(.84)">
            {/* Transparent f-holes keep the instrument a single cut-paper silhouette. */}
            <g mask="url(#ranma-violin-cutouts)">
              <use href="#ranma-violin-solid" fill="currentColor" />
            </g>
            <g class="ranma-motion ranma-bow" stroke="currentColor" stroke-linejoin="round">
              <path d="M61 80Q74-9 65-108L73-114 73-100" stroke-width="3" />
              <path d="M68 77 73-104" stroke-width="1.8" />
              <path d="M60 67H69V80H60Z" fill="currentColor" stroke-width="1" />
              <path d="M62 80V86" stroke-width="3" />
            </g>
          </g>
        </g>

        {/* The top is flush and straight; the carved shoulders belong to the lower edge. */}
        <path
          transform="translate(0 248) scale(1 -1)"
          d="M0 66H256Q268 66 277 53L296 27H397Q418 27 433 15H527Q542 27 563 27H664L683 53Q692 66 704 66H960V248H0ZM0 76V237H960V76H702Q684 76 675 61L657 38H561Q540 38 523 26H437Q420 38 399 38H303L285 61Q276 76 258 76Z"
          fill="currentColor"
          fill-rule="evenodd"
        />
      </svg>
    </div>
  );
});

const ranmaStyles = css`
  width: 100%;
  color: var(--ink);
  margin: 0 0 clamp(24px, 4vw, 44px);
  box-sizing: border-box;
  pointer-events: none;
  & svg {
    display: block;
    width: 100%;
    height: auto;
    overflow: hidden;
  }
  --ranma-progress: 0;
  & .ranma-bow {
    transform-origin: 66px -10px;
    animation-name: ranma-bow;
  }
  & .ranma-current {
    animation-name: ranma-current;
  }
  & .ranma-note-turn {
    transform-box: fill-box;
    transform-origin: center;
    animation-name: ranma-note-turn;
  }
  & .ranma-wing {
    transform-origin: 0px 5px;
    animation-name: ranma-wing;
  }
  & .ranma-far-wing {
    transform-origin: 0px 3px;
    animation-name: ranma-far-wing;
  }
  & .ranma-flight-tail {
    transform-origin: -18px 3px;
    animation-name: ranma-flight-tail;
  }
  & .ranma-perched-head {
    transform-origin: 11px -14px;
    animation-name: ranma-perched-head;
  }
  & .ranma-perched-tail {
    transform-origin: -3px 7px;
    animation-name: ranma-perched-tail;
  }
  & .ranma-bird-flight {
    animation-name: ranma-bird-flight;
  }
  & .ranma-deer-head {
    transform-origin: 43px -74px;
    animation-name: ranma-deer-head;
  }
  & .ranma-deer-tail {
    transform-origin: -73px -76px;
    animation-name: ranma-deer-tail;
  }
  & .ranma-deer-ear {
    transform-origin: 61px -127px;
    animation-name: ranma-deer-ear;
  }
  & .ranma-cloud-drift {
    animation-name: ranma-cloud-drift;
  }
  & .ranma-moon {
    animation-name: ranma-moon;
  }
  & .ranma-reed {
    transform-origin: 0px 0px;
    animation-name: ranma-reed;
  }
  & .ranma-petal {
    animation-name: ranma-petal;
  }
  & .ranma-motion {
    animation-duration: 1s;
    animation-timing-function: linear;
    animation-fill-mode: both;
    animation-play-state: paused;
    animation-delay: calc(var(--ranma-progress) * -1s);
  }
  & .ranma-motion.ranma-deer-head,
  & .ranma-motion.ranma-deer-ear,
  & .ranma-motion.ranma-deer-tail {
    animation-timing-function: ease-in-out;
  }
  @keyframes ranma-current {
    0% {
      transform: translate(-26px, 5px);
    }
    50% {
      transform: translate(0, -6px);
    }
    100% {
      transform: translate(32px, 2px);
    }
  }
  @keyframes ranma-note-turn {
    0% {
      transform: rotate(-9deg);
    }
    50% {
      transform: rotate(8deg);
    }
    100% {
      transform: rotate(-5deg);
    }
  }
  @keyframes ranma-bow {
    0%,
    50%,
    100% {
      transform: translate(-5px, -6px) rotate(-4deg);
    }
    25%,
    75% {
      transform: translate(5px, -2px) rotate(3deg);
    }
  }
  @keyframes ranma-wing {
    0%,
    48%,
    100% {
      transform: rotate(-12deg) scaleY(0.9);
    }
    22%,
    74% {
      transform: rotate(18deg) scaleY(-0.72);
    }
  }
  @keyframes ranma-far-wing {
    0%,
    48%,
    100% {
      transform: rotate(8deg) scaleY(0.65);
    }
    22%,
    74% {
      transform: rotate(-14deg) scaleY(-0.9);
    }
  }
  @keyframes ranma-flight-tail {
    0%,
    48%,
    100% {
      transform: rotate(-7deg);
    }
    22%,
    74% {
      transform: rotate(9deg);
    }
  }
  @keyframes ranma-perched-head {
    0%,
    20%,
    100% {
      transform: rotate(0);
    }
    48%,
    65% {
      transform: rotate(12deg);
    }
  }
  @keyframes ranma-perched-tail {
    0%,
    20%,
    100% {
      transform: rotate(0);
    }
    48%,
    65% {
      transform: rotate(-7deg);
    }
  }
  @keyframes ranma-bird-flight {
    0% {
      transform: translate(-6px, 3px) rotate(-4deg);
    }
    22% {
      transform: translate(-2px, -3px) rotate(3deg);
    }
    48% {
      transform: translate(2px, 2px) rotate(-3deg);
    }
    74% {
      transform: translate(6px, -4px) rotate(4deg);
    }
    100% {
      transform: translate(10px, 1px) rotate(-2deg);
    }
  }
  @keyframes ranma-deer-head {
    0%,
    18% {
      transform: rotate(0);
    }
    38% {
      transform: rotate(3deg);
    }
    56% {
      transform: rotate(1deg);
    }
    78% {
      transform: rotate(-5deg);
    }
    100% {
      transform: rotate(-3deg);
    }
  }
  @keyframes ranma-deer-ear {
    0%,
    56% {
      transform: rotate(0);
    }
    72% {
      transform: rotate(-14deg);
    }
    86% {
      transform: rotate(-5deg);
    }
    100% {
      transform: rotate(-10deg);
    }
  }
  @keyframes ranma-deer-tail {
    0%,
    56% {
      transform: rotate(-3deg);
    }
    72% {
      transform: rotate(7deg);
    }
    100% {
      transform: rotate(-3deg);
    }
  }
  @keyframes ranma-cloud-drift {
    from {
      transform: translateX(-20px);
    }
    to {
      transform: translateX(24px);
    }
  }
  @keyframes ranma-moon {
    from {
      transform: translateY(10px) rotate(-12deg);
    }
    to {
      transform: translateY(-2px) rotate(3deg);
    }
  }
  @keyframes ranma-reed {
    0%,
    100% {
      transform: rotate(-5deg);
    }
    50% {
      transform: rotate(9deg);
    }
  }
  @keyframes ranma-petal {
    from {
      transform: translate(-9px, -10px) rotate(-30deg);
    }
    to {
      transform: translate(19px, 26px) rotate(100deg);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    & .ranma-motion {
      animation: none;
    }
  }
  @media print {
    display: none;
  }
`;

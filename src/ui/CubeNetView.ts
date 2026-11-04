import { COLOR_CSS_MAP } from '../core/constants';
import type { CubeFacesSnapshot, FaceGrid, FaceName } from '../core/types';

export function render2DCubeNet(root: HTMLElement, faces: CubeFacesSnapshot): void {
  const netContainer = root.querySelector<HTMLElement>('#cube-2d-net');
  if (!netContainer) return;

  const renderFaceGrid = (faceName: FaceName, grid: FaceGrid): string => {
    const cells = grid
      .flat()
      .map(
        (color) =>
          `<span class="net-sticker" style="background-color: ${COLOR_CSS_MAP[color]}" data-color="${color}"></span>`
      )
      .join('');
    return `<div class="net-face net-face-${faceName}" data-face="${faceName}" title="Face ${faceName}">${cells}</div>`;
  };

  netContainer.innerHTML = `
    <div class="net-row">
      <div class="net-spacer"></div>
      ${renderFaceGrid('U', faces.U)}
      <div class="net-spacer"></div>
      <div class="net-spacer"></div>
    </div>
    <div class="net-row">
      ${renderFaceGrid('L', faces.L)}
      ${renderFaceGrid('F', faces.F)}
      ${renderFaceGrid('R', faces.R)}
      ${renderFaceGrid('B', faces.B)}
    </div>
    <div class="net-row">
      <div class="net-spacer"></div>
      ${renderFaceGrid('D', faces.D)}
      <div class="net-spacer"></div>
      <div class="net-spacer"></div>
    </div>
  `;
}

export function formatElapsedTimerMs(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  const tenths = Math.floor((ms % 1000) / 100);
  return `${minutes}:${seconds}.${tenths}`;
}

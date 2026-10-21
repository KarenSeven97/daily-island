const outline='M12 2.4 15 8.7 22 9.6 16.9 14.5 18.2 21.4 12 18.1 5.8 21.4 7.1 14.5 2 9.6 9 8.7Z';
export function starMarks(count,pending=false){
  return [0,1,2].map(i=>`<g transform="translate(${i*29} 0)" class="journal-star ${!pending&&i<count?'is-earned':'is-unlit'}"><path d="${outline}"/><path class="star-etch" d="m12 6 .8 5.2L18 12l-5.2.8L12 18l-.8-5.2L6 12l5.2-.8Z"/></g>`).join('');
}
export function starRating(count,pending=false){
  return `<svg class="journal-star-rating${pending?' is-pending':''}" viewBox="0 0 82 24" aria-hidden="true">${starMarks(count,pending)}</svg>`;
}


/** Flag image from an ISO country code — emoji flags don't render on Windows. */
export default function CountryFlag({ code }: { code: string }) {
  return (
    <img
      src={`https://flagcdn.com/w20/${code.toLowerCase()}.png`}
      srcSet={`https://flagcdn.com/w40/${code.toLowerCase()}.png 2x`}
      alt=""
      loading="lazy"
      className="h-3 w-5 shrink-0 rounded-[2px] object-cover ring-1 ring-slate-200"
    />
  )
}

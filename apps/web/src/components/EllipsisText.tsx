type Props = {
  text: string
  count?: number
}

export const EllipsisText = ({ text, count = 10 }: Props) => {
  const finalText = text.trim().length > count ? `${text.slice(0, count)}...` : text
  return <span title={text.trim()}>{finalText}</span>
}

import type { FileStat } from '@/types'
import { formatFileSize } from '@/utils'
export const BasicInfo = ({ data }: { data?: FileStat }) =>
  data ? (
    <p>
      {data.paramSfo?.TITLE} · {formatFileSize(data.size)}
    </p>
  ) : null

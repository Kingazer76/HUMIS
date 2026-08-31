import { activeAssistantLanguages, type AssistantLanguageId } from '@aquaflow/shared'
import { Label } from '@/components/ui/label'

/**
 * Small language picker for the existing Assistant dialog.
 * Default is English. Codes stay out of the farmer-facing labels.
 */
export function AssistantLanguageSelect({
  value,
  onChange,
}: {
  value: AssistantLanguageId
  onChange: (id: AssistantLanguageId) => void
}) {
  const options = activeAssistantLanguages()

  return (
    <div className="flex min-w-0 flex-col gap-1">
      <Label htmlFor="assistant-language" className="text-xs text-muted-foreground">
        Language
      </Label>
      <select
        id="assistant-language"
        value={value}
        onChange={(event) => onChange(event.target.value as AssistantLanguageId)}
        className="h-9 w-full rounded-lg border border-input bg-card px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        aria-label="Assistant language"
      >
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {`🇬🇭 ${option.label}`}
          </option>
        ))}
      </select>
    </div>
  )
}

/**
 * CreateHotelModal - Модальное окно создания отеля
 */

import { useState } from 'react'
import { X, Plus, Check } from 'lucide-react'
import MarshaCodeSelector from '../../../MarshaCodeSelector'
import { CityAutocomplete } from '../../../hotels/CityAutocomplete'
import { cn } from '../../../../utils/classNames'


export default function CreateHotelModal({
  isOpen,
  onClose,
  onSubmit,
  formState,
  setFormState,
  t
}) {
  const [timezoneDetected, setTimezoneDetected] = useState(false)

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-xl p-6 w-full max-w-xl shadow-xl animate-slide-up min-h-[500px] max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-foreground">Создать отель</h3>
          <button onClick={onClose} className="p-2 hover:bg-muted rounded-lg">
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>
        <div className="space-y-4">
          <MarshaCodeSelector
            hotelName={formState.name}
            selectedCode={formState.marsha_code}
            required={true}
            onSelect={(code, codeId) =>
              setFormState({
                ...formState,
                marsha_code: code,
                marsha_code_id: codeId
              })
            }
            onSelectWithDetails={(marshaCode) => {
              setFormState((prev) => ({
                ...prev,
                name: marshaCode.hotel_name,
                marsha_code: marshaCode.code,
                marsha_code_id: marshaCode.id,
                address: marshaCode.city && marshaCode.country ? `${marshaCode.city}, ${marshaCode.country}` : prev.address,
                city: marshaCode.city ?? prev.city,
                country: marshaCode.country ?? prev.country,
                timezone: marshaCode.timezone || prev.timezone || 'Asia/Qostanay',
                latitude: marshaCode.coordinates?.lat ?? prev.latitude ?? null,
                longitude: marshaCode.coordinates?.lng ?? prev.longitude ?? null,
                timezone_auto_detected: Boolean(marshaCode.timezone)
              }))
              if (marshaCode.timezone) {
                setTimezoneDetected(true)
                setTimeout(() => setTimezoneDetected(false), 3000)
              }
            }}
            onClear={() =>
              setFormState({
                name: '',
                description: '',
                address: '',
                city: '',
                country: '',
                timezone: 'Asia/Qostanay',
                latitude: null,
                longitude: null,
                timezone_auto_detected: false,
                marsha_code: '',
                marsha_code_id: null
              })
            }
          />

          {formState.marsha_code && (
            <>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Название отеля
                </label>
                <input
                  type="text"
                  value={formState.name}
                  readOnly
                  className="w-full px-4 py-2.5 border border-border rounded-lg bg-muted/50 text-foreground cursor-not-allowed"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Заполняется автоматически из MARSHA кода
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Адрес</label>
                <input
                  type="text"
                  placeholder="Уточните адрес"
                  value={formState.address}
                  onChange={(e) => setFormState({ ...formState, address: e.target.value })}
                  className="w-full px-4 py-2.5 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent bg-card"
                />
              </div>

              {!formState.timezone_auto_detected && (
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    {t('hotels.cityLabel')}
                    <span className="text-xs text-muted-foreground ml-2">
                      ({t('hotels.timezoneAutoHint')})
                    </span>
                  </label>
                  <CityAutocomplete
                    value={formState.city}
                    onChange={(city) =>
                      setFormState((prev) => ({ ...prev, city }))
                    }
                    onTimezoneDetected={(data) => {
                      if (data) {
                        setFormState((prev) => ({
                          ...prev,
                          timezone: data.timezone,
                          city: data.city,
                          country: data.country,
                          latitude: data.coordinates?.lat ?? null,
                          longitude: data.coordinates?.lng ?? null,
                          timezone_auto_detected: true
                        }))
                        setTimezoneDetected(true)
                        setTimeout(() => setTimezoneDetected(false), 3000)
                      }
                    }}
                  />
                </div>
              )}

              {formState.city && formState.timezone_auto_detected && (
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    {t('hotels.cityLabel')}
                  </label>
                  <input
                    type="text"
                    value={[formState.city, formState.country].filter(Boolean).join(', ')}
                    readOnly
                    className="w-full px-4 py-2.5 border border-border rounded-lg bg-muted/50 text-foreground cursor-not-allowed"
                  />
                  <p className="text-xs text-success flex items-center gap-1.5 mt-1">
                    <Check className="w-3.5 h-3.5 flex-shrink-0" aria-hidden />
                    {t('hotels.filledFromMarsha')}
                  </p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  {t('hotels.timezoneLabel')}
                </label>
                <input
                  type="text"
                  value={formState.timezone}
                  onChange={(e) =>
                    setFormState({
                      ...formState,
                      timezone: e.target.value,
                      timezone_auto_detected: false
                    })
                  }
                  placeholder={t('hotels.timezonePlaceholder')}
                  className={cn(
                    'w-full px-4 py-2.5 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent bg-card',
                    timezoneDetected && 'border-green-500 dark:border-green-600'
                  )}
                />
                {timezoneDetected && (
                  <p className="text-xs text-green-600 dark:text-green-400 mt-1 flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5 flex-shrink-0" aria-hidden />
                    {t('hotels.timezoneDetected')}
                  </p>
                )}
                {formState.timezone_auto_detected && !timezoneDetected && (
                  <p className="text-xs text-success flex items-center gap-1.5 mt-1">
                    <Check className="w-3.5 h-3.5 flex-shrink-0" aria-hidden />
                    {t('hotels.timezoneFromMarsha')}
                  </p>
                )}
                <p className="text-xs text-muted-foreground mt-1">
                  {t('hotels.timezoneManualHint')}
                </p>
              </div>
            </>
          )}

          <button
            onClick={onSubmit}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-accent-button text-white rounded-lg hover:bg-accent-button/90 disabled:opacity-50"
          >
            <Plus className="w-4 h-4" />
            Создать
          </button>
        </div>
      </div>
    </div>
  )
}

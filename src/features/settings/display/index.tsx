import { ContentSection } from '../components/content-section'
import { DisplayForm } from './display-form'

export function SettingsDisplay() {
  return (
    <ContentSection
      title='显示'
      desc="打开或关闭各项，以控制应用中显示的内容。"
    >
      <DisplayForm />
    </ContentSection>
  )
}

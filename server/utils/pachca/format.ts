export function escapeMd(s: string): string {
  return s.replace(/([\\*_`~[\]()])/g, '\\$1')
}

export function linkRequestMarkdown(workspaceName: string): string {
  return `**Такт: подтвердите привязку**\nТак уведомления из пространства «${escapeMd(workspaceName)}» будут приходить сюда. Ссылка одноразовая.`
}

export function linkDoneMarkdown(workspaceName: string): string {
  return `Готово! Уведомления Такта из «${escapeMd(workspaceName)}» будут приходить сюда. Выбрать события можно в настройках уведомлений Такта.`
}

import type { Translation } from '../../types';

export const online: Translation = {
  'online.assetsQuota': 'Место для копий файлов для игроков закончилось, поэтому новые файлы до них не доходят. Удалите копии в панели стола, чтобы освободить место.',
  'online.assetsRestricted': 'Этой учётной записи сейчас нельзя делиться файлами с игроками.',
  'online.assetsMapTooLarge': 'Эта карта пока слишком велика, чтобы показать её игрокам.',
  'online.mapUnreadable': 'Изображение карты этой сцены нельзя передать игрокам.',
  'online.assetsFailed': 'Не удалось передать файл игрокам.',
  'online.sharedUsage': 'Для игроков хранится: {used} из {quota}',
  'online.sharedUsageLeaves': {
    one: 'Для игроков хранится: {used} из {quota}, самая старая копия исчезнет через {count} день',
    few: 'Для игроков хранится: {used} из {quota}, самая старая копия исчезнет через {count} дня',
    many: 'Для игроков хранится: {used} из {quota}, самая старая копия исчезнет через {count} дней',
    other: 'Для игроков хранится: {used} из {quota}, самая старая копия исчезнет через {count} дня',
  },
  'online.sharedUsageToday': 'Для игроков хранится: {used} из {quota}, самая старая копия исчезнет сегодня',
  'online.sharedUnknown': 'Сейчас не удаётся проверить копии для игроков',
  'online.removeShared': 'Удалить копии сейчас',
  'online.removeSharedTitle': 'Удаление копий',
  'online.removeSharedQuestion': 'Удалить все копии, хранящиеся для игроков? Файлы, которые стол ещё показывает, будут переданы снова.',
  'online.removeSharedAction': 'Удалить',
  'online.removedShared': 'Копии удалены.',
  'online.removeSharedFailed': 'Не удалось удалить копии. Попробуйте позже.',
  'online.deleteOnSignOut': 'Удалять копии при выходе',
  'online.deleteOnSignOutDesc': 'Удаляет файлы, хранящиеся для игроков, когда это устройство выходит из учётной записи.',
};

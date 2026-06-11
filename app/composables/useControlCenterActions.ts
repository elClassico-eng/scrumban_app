export function useControlCenterActions() {
  const createTaskTick = useState('cc-create-task-tick', () => 0)
  const searchTick = useState('cc-search-tick', () => 0)

  function requestCreateTask() {
    createTaskTick.value++
  }

  function requestSearch() {
    searchTick.value++
  }

  return { createTaskTick, searchTick, requestCreateTask, requestSearch }
}

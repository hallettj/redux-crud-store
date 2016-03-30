import { fromJS } from 'immutable'
import uuid from 'node-uuid'
import {
  FETCH, FETCH_SUCCESS, FETCH_ERROR,
  FETCH_ONE, FETCH_ONE_SUCCESS, FETCH_ONE_ERROR,
  CREATE, CREATE_SUCCESS, CREATE_ERROR,
  UPDATE, UPDATE_SUCCESS, UPDATE_ERROR,
  DELETE, DELETE_SUCCESS, DELETE_ERROR,
  CLEAR_ACTION_STATUS, API_CALL
} from './actionTypes'

/*
 * SECTION: initial states
 */

const byIdInitialState = fromJS({})

const collectionInitialState = fromJS({
  params: {},
  other_info: {},
  ids: [],
  fetchTime: null,
  error: null
})

const collectionsInitialState = fromJS([])

const actionStatusInitialState = fromJS({
  create: {},
  update: {},
  delete: {}
})

const modelInitialState = fromJS({
  collections: undefined,
  byId: undefined,
  actionStatus: undefined
})

// holds a number of models, each of which are strucured like modelInitialState
const initialState = fromJS({})

/*
 * SECTION: reducers
 */

// server data is canonical, so blast away the old data
function byIdReducer(state = byIdInitialState, action) {
  const id = action.meta ? action.meta.id : undefined
  switch (action.type) {
    case FETCH_SUCCESS:
      const data = state.toJS()
      action.payload.data.forEach((record) => {
        data[record.id] = {
          record,
          fetchTime: action.meta.fetchTime,
          error: null
        }
      })
      return fromJS(data)
    case FETCH_ONE:
      return state.setIn([id.toString(), 'fetchTime'], 0)
                  .setIn([id.toString(), 'error'], null)
                  .setIn([id.toString(), 'record'], null)
    case FETCH_ONE_SUCCESS:
      return state.setIn([id.toString(), 'fetchTime'], action.meta.fetchTime)
                  .setIn([id.toString(), 'error'], null)
                  .setIn([id.toString(), 'record'], fromJS(action.payload))
    case FETCH_ONE_ERROR:
      return state.setIn([id.toString(), 'fetchTime'], action.meta.fetchTime)
                  .setIn([id.toString(), 'error'], fromJS(action.payload))
                  .setIn([id.toString(), 'record'], null)
    case CREATE_SUCCESS:
      const cid = action.payload.id
      if (state.get(cid.toString()) !== undefined) {
        // console.error(`There was already a record at that id (${action.payload.id}) - erasing!`)
      }
      return state.set(action.payload.id.toString(), fromJS({
        record: action.payload,
        fetchTime: action.meta.fetchTime,
        error: null
      }))
    case UPDATE:
      return state.setIn([id.toString(), 'fetchTime'], 0)
    case UPDATE_SUCCESS:
      return state.set(id.toString(), fromJS({
        record: action.payload,
        fetchTime: action.meta.fetchTime,
        error: null
      }))
    case UPDATE_ERROR:
      return state.setIn([id.toString(), 'error'], fromJS(action.payload))
    case DELETE_SUCCESS:
      return state.delete(id.toString())
    default:
      return state
  }
}

/*
 * Note: fetchTime of null means "needs fetch"
 */
function collectionReducer(state = collectionInitialState, action) {
  const id = action.meta ? action.meta.id : undefined
  const params = fromJS(action.meta.params)
  switch (action.type) {
    case FETCH:
      return state.set('params', params)
                  .set('fetchTime', 0)
                  .set('error', null)
    case FETCH_SUCCESS:
      const ids = action.payload.data.map((elt) => elt.id)
      return state.set('params', params)
                  .set('ids', fromJS(ids))
                  .set('other_info', fromJS(action.payload || {}).delete('data'))
                  .set('error', null)
                  .set('fetchTime', action.meta.fetchTime)
    case FETCH_ERROR:
      return state.set('params', params)
                  .set('error', action.payload)
    case CREATE_SUCCESS:
      return state.set('params', params)
                  .set('fetchTime', null)
    case DELETE_SUCCESS:
      return state.set('params', params)
                  .set('fetchTime', null)
    default:
      return state
  }
}

function collectionsReducer(state = collectionsInitialState, action) {
  switch (action.type) {
    case FETCH:
    case FETCH_SUCCESS:
    case FETCH_ERROR:
    case CREATE_SUCCESS:
    case DELETE_SUCCESS:
      // create the collection for the given params if needed
      // entry will be undefined or [index, existingCollection]
      const paramsJson = JSON.stringify(action.meta.params)
      const entry = state.findEntry(coll => (
        JSON.stringify(coll.toJS().params) === paramsJson
      ))
      if (entry === undefined) {
        return state.push(collectionReducer(undefined, action))
      }
      return state.update(entry[0], s => collectionReducer(s, action))
    default:
      return state
  }
}


function actionStatusReducer(state = actionStatusInitialState, action) {
  const { req_uuid } = action.meta
  switch (action.type) {
    case CLEAR_ACTION_STATUS:
      return state.set(action.payload.action, fromJS({}))
    case CREATE:
      return state.setIn(['create', req_uuid], fromJS({
        pending: true, req_uuid
      }))
    case CREATE_SUCCESS:
      return state.setIn(['create', req_uuid], fromJS({
        pending: false, isSuccess: true, message: null, errors: {},
        id: action.payload.id, req_uuid
      }))
    case CREATE_ERROR:
      return state.setIn(['create', req_uuid], fromJS({
        pending: false, isSuccess: false, message: action.payload.message,
        errors: action.payload.errors || {}, id: null, req_uuid
      }))
    case UPDATE:
      return state.setIn(['create', req_uuid], fromJS({
        pending: true, id: action.payload.id, req_uuid
      }))
    case UPDATE_SUCCESS:
      return state.setIn(['update', req_uuid], fromJS({
        pending: false, isSuccess: true, message: null, errors: {},
        id: action.payload.id, req_uuid
      }))
    case UPDATE_ERROR:
      return state.setIn(['update', req_uuid], fromJS({
        pending: false, isSuccess: false, message: action.payload.message,
        errors: action.payload.errors, id: null, req_uuid
      }))
    case DELETE:
      return state.setIn(['delete', req_uuid], fromJS({
        pending: true, id: action.payload.id, req_uuid
      }))
    case DELETE_SUCCESS:
      return state.setIn(['delete', req_uuid], fromJS({
        pending: false, isSuccess: true, message: null, errors: null,
        id: action.meta.id, req_uuid
      }))
    case DELETE_ERROR:
      // probably action.payload will be null or {} but whatever!!
      return state.setIn(['delete', action.meta.req_uuid], fromJS({
        pending: false, isSuccess: false, message: action.payload.message,
        errors: action.payload.errors, id: action.meta.id, req_uuid
      }))
    default:
      return state
  }
}

export default function crudReducer(state = initialState, action) {
  const id = action.meta ? action.meta.id : undefined
  switch (action.type) {
    case CLEAR_ACTION_STATUS:
      return state.updateIn([action.meta.model, 'actionStatus'],
                          (s) => actionStatusReducer(s, action))
    case FETCH:
    case FETCH_SUCCESS:
    case FETCH_ERROR:
      return state.updateIn([action.meta.model, 'collections'],
                            (s) => collectionsReducer(s, action))
                  .updateIn([action.meta.model, 'byId'],
                            (s) => byIdReducer(s, action))
    case FETCH_ONE:
    case FETCH_ONE_SUCCESS:
    case FETCH_ONE_ERROR:
      return state.updateIn([action.meta.model, 'byId'],
                            (s) => byIdReducer(s, action))
    case CREATE:
      return state.updateIn([action.meta.model, 'actionStatus'],
                            (s) => actionStatusReducer(s, action))
    case CREATE_SUCCESS:
      return state.updateIn([action.meta.model, 'byId'],
                            (s) => byIdReducer(s, action))
                  .updateIn([action.meta.model, 'collections'],
                            (list) => list.map(s => collectionReducer(s, action)))
                  .updateIn([action.meta.model, 'actionStatus'],
                            (s) => actionStatusReducer(s, action))
    case CREATE_ERROR:
      return state.updateIn([action.meta.model, 'actionStatus'],
                            (s) => actionStatusReducer(s, action))
    case UPDATE:
    case UPDATE_SUCCESS:
    case UPDATE_ERROR:
      return state.updateIn([action.meta.model, 'byId'],
                            (s) => byIdReducer(s, action))
                  .updateIn([action.meta.model, 'actionStatus'],
                            (s) => actionStatusReducer(s, action))
    case DELETE:
    case DELETE_SUCCESS:
    case DELETE_ERROR:
      return state.updateIn([action.meta.model, 'byId'],
                            (s) => byIdReducer(s, action))
                  .updateIn([action.meta.model, 'collections'],
                            (list) => list.map(s => collectionReducer(s, action)))
                  .updateIn([action.meta.model, 'actionStatus'],
                            (s) => actionStatusReducer(s, action))
    default:
      return state
  }
}

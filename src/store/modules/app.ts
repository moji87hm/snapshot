import { getInstance } from '@snapshot-labs/lock/plugins/vue3';
import { signMessage } from '@snapshot-labs/snapshot.js/src/utils/web3';
import client from '@/helpers/client';
import { formatSpace } from '@/helpers/utils';
import { version } from '@/../package.json';
import i18n, {
  defaultLocale,
  setI18nLanguage,
  loadLocaleMessages
} from '@/i18n';

import { lsGet, lsSet } from '@/helpers/utils';

const state = {
  init: false,
  loading: false,
  authLoading: false,
  modalOpen: false,
  spaces: {},
  locale: lsGet('locale', defaultLocale)
};

const mutations = {
  SET(_state, payload) {
    Object.keys(payload).forEach(key => {
      _state[key] = payload[key];
    });
  },
  SEND_REQUEST() {
    console.debug('SEND_REQUEST');
  },
  SEND_SUCCESS() {
    console.debug('SEND_SUCCESS');
  },
  SEND_FAILURE(_state, payload) {
    console.debug('SEND_FAILURE', payload);
  }
};

const actions = {
  init: async ({ commit, dispatch }) => {
    await loadLocaleMessages(i18n, state.locale);
    setI18nLanguage(i18n, state.locale);
    const auth = getInstance();
    commit('SET', { loading: true });
    await dispatch('getSpaces');
    auth.getConnector().then(connector => {
      if (connector) dispatch('login', connector);
    });
    commit('SET', { loading: false, init: true });
  },
  loading: ({ commit }, payload) => {
    commit('SET', { loading: payload });
  },
  toggleModal: ({ commit }) => {
    commit('SET', { modalOpen: !state.modalOpen });
  },
  getSpaces: async ({ commit }) => {
    let spaces: any = await client.request('spaces');
    spaces = Object.fromEntries(
      Object.entries(spaces).map(space => [
        space[0],
        formatSpace(space[0], space[1])
      ])
    );

    spaces['fei.eth'].strategies = [
      {
        name: 'pagination',
        params: {
          symbol: 'FEI-TRIBE Staked LP',
          strategy: {
            name: 'staked-uniswap',
            params: {
              tokenAddress: '0xc7283b66Eb1EB5FB86327f08e1B5816b0720212B',
              uniswapAddress: '0x9928e4046d7c6513326cCeA028cD3e7a91c7590A',
              stakingAddress: '0x18305DaAe09Ea2F4D51fAa33318be5978D251aBd',
              decimals: 18
            }
          }
        }
      },
      {
        name: 'pagination',
        params: {
          symbol: 'TRIBE',
          strategy: {
            name: 'erc20-balance-of',
            params: {
              symbol: 'TRIBE',
              address: '0x1165a505e8c4e82b7b98e77374c789dbd7b53f9a',
              decimals: 18
            }
          }
        }
      }
    ];

    commit('SET', { spaces });
    return spaces;
  },
  send: async ({ commit, dispatch, rootState }, { space, type, payload }) => {
    const auth = getInstance();
    commit('SEND_REQUEST');
    try {
      const msg: any = {
        address: rootState.web3.account,
        msg: JSON.stringify({
          version,
          timestamp: (Date.now() / 1e3).toFixed(),
          space,
          type,
          payload
        })
      };
      msg.sig = await signMessage(auth.web3, msg.msg, rootState.web3.account);
      const result = await client.request('message', msg);
      commit('SEND_SUCCESS');
      dispatch('notify', [
        'green',
        type === 'delete-proposal'
          ? i18n.global.t('notify.proposalDeleted')
          : i18n.global.t('notify.yourIsIn', [type])
      ]);
      return result;
    } catch (e) {
      commit('SEND_FAILURE', e);
      const errorMessage =
        e && e.error_description
          ? `Oops, ${e.error_description}`
          : i18n.global.t('notify.somethingWentWrong');
      dispatch('notify', ['red', errorMessage]);
      return;
    }
  },
  async setLocale(state, locale) {
    state.locale = locale;
    lsSet('locale', locale);
    await loadLocaleMessages(i18n, locale);
    setI18nLanguage(i18n, locale);
  }
};

export default {
  state,
  mutations,
  actions
};

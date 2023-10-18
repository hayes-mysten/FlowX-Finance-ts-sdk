import {
  JsonRpcProvider,
  PaginatedObjectsResponse,
  SuiObjectDataFilter,
  SuiObjectDataOptions,
  TransactionBlock,
  getPureSerializationType,
} from "@mysten/sui.js";
import {
  LP_DECIMAL,
  MAX_LIMIT_PER_RPC_CALL,
  SUI_FULL_TYPE,
  SUI_TYPE,
  client,
  provider,
} from "./constants";
import { BIG_TEN, BigNumberInstance } from "./BigNumber";
import { CoinMetadata, ICoinBalance, IPoolInfo, IPools } from "./types";
import Lodash from "./lodash";
import { COIN_SETTING_QUERY, GET_PAIRS } from "./queries";
import { isObject } from "lodash";

export const nowInMilliseconds = () => {
  return Date.now();
};

export const wait = (ms: number) => {
  return new Promise<void>((resolve) => {
    setTimeout(() => {
      resolve();
    }, ms);
  });
};

export function last<T>(collections: T[]) {
  return collections[collections.length - 1];
}

export const fetchOwnedObjects = async (
  owner: string,
  objectType: string,
  jsonRpcProvider: JsonRpcProvider
) => {
  let cursor;
  let hasNextPage = false;
  let objects = [];
  do {
    const res = await jsonRpcProvider.getOwnedObjects({
      owner,
      cursor,
      limit: MAX_LIMIT_PER_RPC_CALL,
      filter: {
        StructType: objectType,
      },
      options: {
        showContent: true,
        showOwner: true,
        showType: true,
      },
    });
    hasNextPage = res.hasNextPage;
    cursor = res.nextCursor;
    objects.push(res.data.map((item) => item.data));
  } while (!!hasNextPage);

  return objects;
};

export const callGraphQL = async (
  url: string,
  payload: {
    query: string;
    variables: any;
  },
  extractor?: (res: any) => any
) => {
  const res = await fetch(url, {
    method: "POST",
    body: JSON.stringify(payload),
    headers: {
      "content-type": "application/json",
    },
  })
    .catch((error) => {
      throw error;
    })
    .then((res) => res.json());

  if (!!res.errors) {
    console.error(
      "callGraphQL: could not execute graphQL request due to error",
      res.errors
    );
    throw new Error(res.errors[0].extensions.code);
  }

  if (!!extractor) {
    return extractor(res.data);
  }

  return res.data;
};

export const SuiTypeMiniNormalize = (type: string) => {
  return type === SUI_FULL_TYPE ? SUI_TYPE : type;
};
export const removeLeadingZeros = (hexString) => {
  return hexString.replace(/^0+/, "");
};

export const convertAmountDecimal = (amount: number, decimals: number) => {
  return amount / 10 ** decimals;
};
export const stripZeros = (a: string): string => {
  let first = a[0];
  while (a.length > 0 && first.toString() === "0") {
    a = a.slice(1);
    first = a[0];
  }
  return a;
};
export const addZerosX = (text: string): string => {
  return `${text.startsWith("0x") ? "" : "0x"}${text}`;
};
export const getLpType = (lpType: string, coinX: string, coinY: string) => {
  if (!lpType) {
    return "";
  }
  let lpTypeFormatted: any = lpType.split("Supply")[1].slice(1, -1);
  lpTypeFormatted = lpTypeFormatted.split("<");
  return `${lpTypeFormatted[0]}<${coinX}, ${coinY}>`;
};
export const formatCoinType = (type: string): string => {
  const COIN_TYPE_ARG_REGEX = /^0x2::coin::Coin<(.+)>$/;
  const [, res] = type.match(COIN_TYPE_ARG_REGEX) ?? [];
  const typeFormatted = stripZeros(res.slice(2) || "");

  return `0x${typeFormatted}`;
};
export const getDecimalAmount = (
  amount: string | number,
  decimals = LP_DECIMAL
) => {
  return BigNumberInstance(amount).times(BIG_TEN.pow(decimals)).toFixed();
};

export const getBalanceAmount = (
  amount: string | number,
  decimals = LP_DECIMAL
) => {
  return BigNumberInstance(amount).div(BIG_TEN.pow(decimals));
};

export const calculateReceiveAmount = (
  poolInfo: IPoolInfo,
  coinX: CoinMetadata,
  coinY: CoinMetadata
) => {
  if (!poolInfo) {
    return { amountX: 0, amountY: 0 };
  }
  const lpRate = 1 / getBalanceAmount(poolInfo.totalLpSupply).toNumber();
  const amountX =
    lpRate *
    getBalanceAmount(
      typeof poolInfo.reserveX === "string"
        ? poolInfo.reserveX
        : poolInfo.reserveX.fields.balance,
      coinX.decimals
    ).toNumber();
  const amountY =
    lpRate *
    getBalanceAmount(
      typeof poolInfo.reserveY === "string"
        ? poolInfo.reserveY
        : poolInfo.reserveY.fields.balance,
      coinY.decimals
    ).toNumber();
  return { amountX, amountY };
};
export const standardizeType = (type: string) => {
  const OBJECT_ID_LENGTH = 64;
  const REGEX_MOVE_OBJECT_ID = /0x[0-9a-fA-F]{1,64}/g;
  let originalCoinX = null;
  originalCoinX = type?.replace(REGEX_MOVE_OBJECT_ID, (match: string) => {
    return `0x${match.slice(2).padStart(OBJECT_ID_LENGTH, "0")}`;
  });
  return type === SUI_TYPE ? SUI_TYPE : originalCoinX;
};

export const sortData = (
  inputData: any[],
  sortType?: string,
  order?: "asc" | "desc" | string
) => {
  let tempArr = [...inputData];
  if ((order === "asc" || order === "desc") && sortType) {
    const sortOrder = order === "asc" ? 1 : -1;
    const compare = (a: any, b: any) => {
      const valueA = +a[sortType];
      const valueB = +b[sortType];
      if (valueA < valueB) {
        return -1 * sortOrder;
      } else if (valueA > valueB) {
        return 1 * sortOrder;
      } else {
        return 0;
      }
    };
    tempArr.sort(compare);
  }
  return tempArr;
};
export const getFullyOwnedObjects = async (
  account: string,
  options: SuiObjectDataOptions,
  filter?: SuiObjectDataFilter
) => {
  let hasNextPage = false;
  const data: any[] = [];
  let cursor = null;
  do {
    const results: PaginatedObjectsResponse = await provider.getOwnedObjects({
      owner: account,
      options,
      cursor,
      filter,
    });

    cursor = results.nextCursor;
    hasNextPage = results.hasNextPage;

    data.push(...results.data);
  } while (hasNextPage);

  return data;
};
const getPoolInfos = async (lpObjectIds: string[]): Promise<IPoolInfo[]> => {
  try {
    const splitObjectIds = [];
    //split array if array is more than 50 elements because
    for (let i = 0; i < lpObjectIds.length; i += 49) {
      splitObjectIds.push(lpObjectIds.slice(i, i + 49));
    }
    const splitPoolInfos = await Promise.all(
      //50 ids maximum
      splitObjectIds.map((items) =>
        provider.multiGetObjects({ ids: items, options: { showContent: true } })
      )
    );
    const poolInfos: IPoolInfo[] = [];
    splitPoolInfos.map((_poolInfos) => {
      _poolInfos.map((data) => {
        const _poolInfo = (data.data.content as any).fields.value.fields;
        const coinX = formatCoinType(_poolInfo.reserve_x.type);
        const coinY = formatCoinType(_poolInfo.reserve_y.type);
        poolInfos.push({
          objectId: data.data.objectId,
          reserveX: _poolInfo.reserve_x,
          reserveY: _poolInfo.reserve_y,
          totalLpSupply: _poolInfo.lp_supply.fields.value,
          lpType: getLpType(_poolInfo.lp_supply.type, coinX, coinY),
          coinX,
          coinY,
          feeRate: _poolInfo.fee_rate
            ? parseFloat(_poolInfo.fee_rate) / 10000
            : 0.003, //default 0.003% if not set
        });
      });
    });
    return poolInfos;
  } catch (e) {
    throw e;
  }
};
export const getPools = async (): Promise<IPools[]> => {
  try {
    const res: any = await client.request(GET_PAIRS, {
      size: 100,
    });
    const pairs = res.getPairs;
    const pairObjectIds = pairs?.map((item) => item.lpObjectId);
    const poolInfo = await getPoolInfos(pairObjectIds);
    return poolInfo.map((item: any, i: number) => ({
      ...pairs[i],
      ...item,
    }));
  } catch (error) {
    throw error;
  }
};
export const getCoinsFlowX = async (): Promise<any> => {
  try {
    const res: any = await client.request(COIN_SETTING_QUERY, {
      limit: 100,
    });
    const listData: CoinMetadata[] = res.getCoinsSettings.items;
    return listData;
  } catch (error) {
    throw error;
  }
};
export const getCoinsBalance = async (
  address?: string
): Promise<Array<{ balance: number; type: string }>> => {
  if (!address) return [];
  const balances = await provider.getAllBalances({ owner: address });
  const balancesFormatted = balances.map((item) => {
    return {
      type: item.coinType,
      balance: +item.totalBalance,
    };
  });
  return Lodash.sortBy(balancesFormatted, ["type", "balance"]);
};
export const getBasicData = async (
  address?: string
): Promise<{
  coins: CoinMetadata[];
  coinBalances: ICoinBalance[];
  poolInfos: any[];
}> => {
  const [coins, coinBalances, poolInfos] = await Promise.all([
    getCoinsFlowX(),
    getCoinsBalance(address),
    getPools(),
  ]);
  return {
    coins,
    coinBalances,
    poolInfos,
  };
};
export const initTxBlock = async (
  packageId: string,
  moduleName: string,
  functionName: string,
  params: any[],
  types?: string[],
  tx?: TransactionBlock
): Promise<any> => {
  if (!tx) {
    tx = new TransactionBlock();
  }

  const functionDetails = await provider.getNormalizedMoveModule({
    package: packageId,
    module: moduleName,
  });

  const args: any =
    params?.map((param: any, i: number) => {
      return isObject(param)
        ? param
        : getPureSerializationType(
            functionDetails.exposedFunctions[functionName]["parameters"][i],
            param
          )
        ? tx.pure(param)
        : tx.object(param);
    }) ?? [];

  tx.moveCall({
    target: `${packageId}::${moduleName}::${functionName}`,
    typeArguments: types ?? [],
    arguments: args,
  });

  // tx.moveCall({
  //   target: `$0x2::coin::zero`,
  //   typeArguments: types ?? [],
  //   arguments: args,
  // });
  return tx;
};

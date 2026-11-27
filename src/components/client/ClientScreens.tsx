"use client";

import dynamic from "next/dynamic";
import { SkeletonPage } from "@/components/ui/Skeletons";

function ScreenLoading() {
  return <SkeletonPage variant="page" label="Đang tải màn hình…" />;
}

export const LoginScreenClient = dynamic(
  () => import("@/features/auth/AuthScreens").then((module) => module.LoginScreen),
  { ssr: false, loading: ScreenLoading },
);
export const RegisterScreenClient = dynamic(
  () => import("@/features/auth/AuthScreens").then((module) => module.RegisterScreen),
  { ssr: false, loading: ScreenLoading },
);
export const ForgotPasswordScreenClient = dynamic(() => import("@/features/auth/AuthScreens").then((module) => module.ForgotPasswordScreen), { ssr: false, loading: ScreenLoading });
export const ResetPasswordScreenClient = dynamic(() => import("@/features/auth/AuthScreens").then((module) => module.ResetPasswordScreen), { ssr: false, loading: ScreenLoading });
export const ChangePasswordScreenClient = dynamic(() => import("@/features/auth/AuthScreens").then((module) => module.ChangePasswordScreen), { ssr: false, loading: ScreenLoading });
export const MyDepositsScreenClient = dynamic(() => import("@/features/auction/MyDepositsScreen").then((module) => module.MyDepositsScreen), { ssr: false, loading: ScreenLoading });
export const RefundsScreenClient = dynamic(() => import("@/features/refunds/RefundsScreen").then((module) => module.RefundsScreen), { ssr: false, loading: ScreenLoading });
export const AuditLogsScreenClient = dynamic(() => import("@/features/admin/operations/OperationsScreens").then((module) => module.AuditLogsScreen), { ssr: false, loading: ScreenLoading });
export const SecurityAlertsScreenClient = dynamic(() => import("@/features/admin/operations/OperationsScreens").then((module) => module.SecurityAlertsScreen), { ssr: false, loading: ScreenLoading });
export const SystemHealthScreenClient = dynamic(() => import("@/features/admin/operations/OperationsScreens").then((module) => module.SystemHealthScreen), { ssr: false, loading: ScreenLoading });
export const AdminShipmentsScreenClient = dynamic(() => import("@/features/admin/AdminShipmentsScreen").then((module) => module.AdminShipmentsScreen), { ssr: false, loading: ScreenLoading });
export const NotificationCenterScreenClient = dynamic(() => import("@/features/admin/notifications/NotificationCenterScreen").then((module) => module.NotificationCenterScreen), { ssr: false, loading: ScreenLoading });
export const LedgerTransactionsScreenClient = dynamic(() => import("@/features/admin/ledger/LedgerScreens").then((module) => module.LedgerTransactionsScreen), { ssr: false, loading: ScreenLoading });
export const LedgerBalancesScreenClient = dynamic(() => import("@/features/admin/ledger/LedgerScreens").then((module) => module.LedgerBalancesScreen), { ssr: false, loading: ScreenLoading });
export const ReconciliationScreenClient = dynamic(() => import("@/features/admin/ledger/LedgerScreens").then((module) => module.ReconciliationScreen), { ssr: false, loading: ScreenLoading });
export const JournalScreenClient = dynamic(() => import("@/features/admin/ledger/LedgerScreens").then((module) => module.JournalScreen), { ssr: false, loading: ScreenLoading });
export const SessionsScreenClient = dynamic(() => import("@/features/account/AccountScreens").then((module) => module.SessionsScreen), { ssr: false, loading: ScreenLoading });
export const NotificationPreferencesScreenClient = dynamic(() => import("@/features/account/AccountScreens").then((module) => module.NotificationPreferencesScreen), { ssr: false, loading: ScreenLoading });
export const SellerDocumentsScreenClient = dynamic(() => import("@/features/account/AccountScreens").then((module) => module.SellerDocumentsScreen), { ssr: false, loading: ScreenLoading });
export const MyWatchlistScreenClient = dynamic(() => import("@/features/auction/MyWatchlistScreen").then((module) => module.MyWatchlistScreen), { ssr: false, loading: ScreenLoading });
export const AddressBookScreenClient = dynamic(() => import("@/features/profile/AddressBookScreen").then((module) => module.AddressBookScreen), { ssr: false, loading: ScreenLoading });
export const AccountProfileScreenClient = dynamic(() => import("@/features/auth/AuthScreens").then((module) => module.AccountProfileScreen), { ssr: false, loading: ScreenLoading });

export const HomeScreenClient = dynamic(
  () => import("@/features/catalog/CatalogScreens").then((module) => module.HomeScreen),
  { ssr: false, loading: ScreenLoading },
);
export const CatalogScreenClient = dynamic(
  () => import("@/features/catalog/CatalogScreens").then((module) => module.CatalogScreen),
  { ssr: false, loading: ScreenLoading },
);
export const ShopsDirectoryScreenClient = dynamic(
  () => import("@/features/catalog/ShopsDirectoryScreen").then((module) => module.ShopsDirectoryScreen),
  { ssr: false, loading: ScreenLoading },
);
export const ProductDetailScreenClient = dynamic(
  () => import("@/features/catalog/CatalogScreens").then((module) => module.ProductDetailScreen),
  { ssr: false, loading: ScreenLoading },
);
export const ShopScreenClient = dynamic(
  () => import("@/features/catalog/ShopScreen").then((module) => module.ShopScreen),
  { ssr: false, loading: ScreenLoading },
);
export const AuctionRoomScreenClient = dynamic(
  () => import("@/features/auction").then((module) => module.AuctionRoomScreen),
  { ssr: false, loading: ScreenLoading },
);
export const AuctionListScreenClient = dynamic(() => import("@/features/auction").then((module) => module.AuctionListScreen), { ssr: false, loading: ScreenLoading });
export const MyAuctionsScreenClient = dynamic(() => import("@/features/auction").then((module) => module.MyAuctionsScreen), { ssr: false, loading: ScreenLoading });
export const BuyerAuctionResultScreenClient = dynamic(() => import("@/features/auction").then((module) => module.BuyerAuctionResultScreen), { ssr: false, loading: ScreenLoading });
export const BuyerAuctionPaymentScreenClient = dynamic(() => import("@/features/auction").then((module) => module.BuyerAuctionResultScreen), { ssr: false, loading: ScreenLoading });
export const OperationsListScreenClient = dynamic(() => import("@/features/auction").then((module) => module.OperationsListScreen), { ssr: false, loading: ScreenLoading });
export const OperationsDetailScreenClient = dynamic(() => import("@/features/auction").then((module) => module.OperationsDetailScreen), { ssr: false, loading: ScreenLoading });
export const SellerAuctionResultScreenClient = dynamic(() => import("@/features/auction").then((module) => module.SellerAuctionResultScreen), { ssr: false, loading: ScreenLoading });
export const SellerAuctionFormScreenClient = dynamic(() => import("@/features/auction").then((module) => module.SellerAuctionEditorScreen), { ssr: false, loading: ScreenLoading });
export const SellerAuctionRecreateScreenClient = dynamic(() => import("@/features/auction").then((module) => module.SellerAuctionEditorScreen), { ssr: false, loading: ScreenLoading });
export const AdminAuctionConfigsScreenClient = dynamic(() => import("@/features/admin").then((module) => module.AdminAuctionConfigsScreen), { ssr: false, loading: ScreenLoading });
export const AdminNotificationsScreenClient = dynamic(() => import("@/features/admin").then((module) => module.AdminNotificationsScreen), { ssr: false, loading: ScreenLoading });

export const CartScreenClient = dynamic(
  () => import("@/features/commerce/BuyerCommerceScreens").then((module) => module.CartScreen),
  { ssr: false, loading: ScreenLoading },
);
export const CheckoutScreenClient = dynamic(
  () => import("@/features/commerce/BuyerCommerceScreens").then((module) => module.CheckoutScreen),
  { ssr: false, loading: ScreenLoading },
);
export const OrdersScreenClient = dynamic(
  () => import("@/features/commerce/BuyerCommerceScreens").then((module) => module.OrdersScreen),
  { ssr: false, loading: ScreenLoading },
);
export const OrderDetailScreenClient = dynamic(
  () => import("@/features/commerce/BuyerCommerceScreens").then((module) => module.OrderDetailScreen),
  { ssr: false, loading: ScreenLoading },
);
export const SubOrderDetailScreenClient = dynamic(
  () => import("@/features/commerce/SubOrderDetailScreen").then((module) => module.SubOrderDetailScreen),
  { ssr: false, loading: ScreenLoading },
);
export const OrderBySubOrderScreenClient = dynamic(
  () => import("@/features/commerce/OrderBySubOrderScreen").then((module) => module.OrderBySubOrderScreen),
  { ssr: false, loading: ScreenLoading },
);
export const BuyerReportsScreenClient = dynamic(() => import("@/features/commerce/CommerceScreens").then((module) => module.BuyerReportsScreen), { ssr: false, loading: ScreenLoading });
export const BuyerOrderReviewScreenClient = dynamic(() => import("@/features/reviews/BuyerOrderReviewScreen").then((module) => module.BuyerOrderReviewScreen), { ssr: false, loading: ScreenLoading });

export const WalletScreenClient = dynamic(
  () => import("@/features/wallet/WalletScreen").then((module) => module.WalletScreen),
  { ssr: false, loading: ScreenLoading },
);
export const TransferScreenClient = dynamic(() => import("@/features/wallet/TransferScreen").then((module) => module.TransferScreen), { ssr: false, loading: ScreenLoading });
export const BuyerTopUpScreenClient = dynamic(() => import("@/features/wallet/WalletOperationsScreens").then((module) => module.BuyerTopUpScreen), { ssr: false, loading: ScreenLoading });
export const SellerWalletScreenClient = dynamic(() => import("@/features/wallet/WalletOperationsScreens").then((module) => module.SellerWalletScreen), { ssr: false, loading: ScreenLoading });
export const SellerWithdrawalsScreenClient = dynamic(() => import("@/features/wallet/WalletOperationsScreens").then((module) => module.SellerWithdrawalsScreen), { ssr: false, loading: ScreenLoading });

export const BecomeSellerScreenClient = dynamic(
  () => import("@/features/seller/SellerScreens").then((module) => module.BecomeSellerScreen),
  { ssr: false, loading: ScreenLoading },
);
export const SellerProductsScreenClient = dynamic(
  () => import("@/features/seller/SellerScreens").then((module) => module.SellerProductsScreen),
  { ssr: false, loading: ScreenLoading },
);
export const SellerProductEditScreenClient = dynamic(
  () => import("@/features/seller/SellerScreens").then((module) => module.SellerProductEditScreen),
  { ssr: false, loading: ScreenLoading },
);
export const SellerProductEditorScreenClient = dynamic(
  () => import("@/features/seller/SellerScreens").then((module) => module.SellerProductEditorScreen),
  { ssr: false, loading: ScreenLoading },
);
export const SellerProductDetailScreenClient = dynamic(
  () => import("@/features/seller/SellerProductDetailScreen").then((module) => module.SellerProductDetailScreen),
  { ssr: false, loading: ScreenLoading },
);
export const SellerInventoryScreenClient = dynamic(
  () => import("@/features/seller/SellerScreens").then((module) => module.SellerInventoryScreen),
  { ssr: false, loading: ScreenLoading },
);
export const SellerOrdersScreenClient = dynamic(
  () => import("@/features/seller/SellerScreens").then((module) => module.SellerOrdersScreen),
  { ssr: false, loading: ScreenLoading },
);
export const SellerShipmentsScreenClient = dynamic(() => import("@/features/seller/SellerScreens").then((module) => module.SellerShipmentsScreen), { ssr: false, loading: ScreenLoading });
export const SellerOrderDetailScreenClient = dynamic(() => import("@/features/seller/SellerScreens").then((module) => module.SellerOrderDetailScreen), { ssr: false, loading: ScreenLoading });
export const SellerShipmentDetailScreenClient = dynamic(() => import("@/features/seller/SellerScreens").then((module) => module.SellerShipmentDetailScreen), { ssr: false, loading: ScreenLoading });
export const SellerShopScreenClient = dynamic(() => import("@/features/seller/SellerScreens").then((module) => module.SellerShopScreen), { ssr: false, loading: ScreenLoading });
export const SellerAuctionsScreenClient = dynamic(
  () => import("@/features/auction").then((module) => module.OperationsListScreen),
  { ssr: false, loading: ScreenLoading },
);
export const SellerAuctionEditorScreenClient = dynamic(
  () => import("@/features/auction").then((module) => module.SellerAuctionEditorScreen),
  { ssr: false, loading: ScreenLoading },
);

export const StaffSellersScreenClient = dynamic(
  () => import("@/features/staff/StaffSellersScreen").then((module) => module.StaffSellersScreen),
  { ssr: false, loading: ScreenLoading },
);
export const StaffSellerDetailScreenClient = dynamic(
  () => import("@/features/staff/StaffSellersScreen").then((module) => module.StaffSellerDetailScreen),
  { ssr: false, loading: ScreenLoading },
);
export const StaffReportsScreenClient = dynamic(
  () => import("@/features/staff/StaffScreens").then((module) => module.StaffReportsScreen),
  { ssr: false, loading: ScreenLoading },
);
export const StaffProductModerationScreenClient = dynamic(
  () => import("@/features/staff/StaffProductModerationScreen").then((module) => module.StaffProductModerationScreen),
  { ssr: false, loading: ScreenLoading },
);
export const StaffProductReviewsScreenClient = dynamic(
  () => import("@/features/staff/StaffProductReviewsScreen").then((module) => module.StaffProductReviewsScreen),
  { ssr: false, loading: ScreenLoading },
);
export const StaffWithdrawalsScreenClient = dynamic(
  () => import("@/features/staff/StaffWithdrawalsScreen").then((module) => module.StaffWithdrawalsScreen),
  { ssr: false, loading: ScreenLoading },
);

export const AdminUsersScreenClient = dynamic(
  () => import("@/features/admin").then((module) => module.AdminUsersScreen),
  { ssr: false, loading: ScreenLoading },
);
export const AdminPenaltiesScreenClient = dynamic(
  () => import("@/features/admin/AdminPenaltiesScreen").then((module) => module.AdminPenaltiesScreen),
  { ssr: false, loading: ScreenLoading },
);
export const AdminRolesScreenClient = dynamic(
  () => import("@/features/admin").then((module) => module.AdminRolesScreen),
  { ssr: false, loading: ScreenLoading },
);
export const AdminOverviewScreenClient = dynamic(() => import("@/features/admin").then((module) => module.AdminOverviewScreen), { ssr: false, loading: ScreenLoading });
export const AdminContractScreenClient = dynamic(() => import("@/features/admin").then((module) => module.AdminContractScreen), { ssr: false, loading: ScreenLoading });
export const AuctionOpsScreenClient = dynamic(() => import("@/features/auction/AuctionOpsScreen").then((module) => module.AuctionOpsScreen), { ssr: false, loading: ScreenLoading });
export const WalletToolsScreenClient = dynamic(() => import("@/features/admin/finance/WalletToolsScreen").then((module) => module.WalletToolsScreen), { ssr: false, loading: ScreenLoading });
export const PlatformFeeScreenClient = dynamic(() => import("@/features/admin/finance/PlatformFeeScreen").then((module) => module.PlatformFeeScreen), { ssr: false, loading: ScreenLoading });
export const SubsidyBudgetsScreenClient = dynamic(() => import("@/features/admin/finance/SubsidyBudgetsScreen").then((module) => module.SubsidyBudgetsScreen), { ssr: false, loading: ScreenLoading });
export const AdminCategoriesScreenClient = dynamic(() => import("@/features/admin").then((module) => module.AdminCategoriesScreen), { ssr: false, loading: ScreenLoading });

export const MyReputationScreenClient = dynamic(
  () => import("@/features/reviews/MyReputationScreen").then((module) => module.MyReputationScreen),
  { ssr: false, loading: ScreenLoading },
);
export const SellerReviewsScreenClient = dynamic(
  () => import("@/features/reviews/SellerReviewsScreen").then((module) => module.SellerReviewsScreen),
  { ssr: false, loading: ScreenLoading },
);
export const SellerCouponsScreenClient = dynamic(
  () => import("@/features/coupons/SellerCouponsScreen").then((module) => module.SellerCouponsScreen),
  { ssr: false, loading: ScreenLoading },
);
